import { NextResponse } from 'next/server';
import { agentByToken } from '@/lib/agents';
import { TOKEN_DECIMALS } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROTOCOL = '2025-06-18';

/**
 * A hosted MCP server, so using Stipend needs no file on disk.
 *
 * The stdio server in mcp/ is right for a developer, but it requires the agent
 * to have the file. This speaks JSON-RPC over HTTP instead: paste the URL into
 * the client, add the agent token, and the tools appear.
 *
 * Auth is the same owner key the console uses. It arrives as a bearer token or
 * a ?token= parameter, because MCP clients differ in what they can send.
 */

type RpcId = string | number | null | undefined;

interface RpcMessage {
  jsonrpc: '2.0';
  id?: RpcId;
  method?: string;
  params?: Record<string, unknown>;
}

const TOOLS = [
  {
    name: 'agent_status',
    description:
      "Check this agent's wallet: balance, per-call cap, daily budget, how much is left today, and the price of each service. Call this before buying if you are unsure whether you can afford a purchase.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'buy_signals',
    description:
      'Buy live public discussion (Hacker News) about a topic. Costs about $0.04 from the agent wallet. Returns real, current threads with points and dates.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The topic to search for, e.g. "usage-based pricing for developer tools".',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'buy_notes',
    description:
      'Buy a short set of decision-grade notes distilled from live discussion. Costs about $0.06. Pass the same query you used for buy_signals to reuse what was already bought.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The topic to summarise.' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'buy_brief',
    description:
      'Buy a one-page memo: a recommendation, the reasoning, and the main risk. Costs about $0.08. Use buy_notes first so the memo builds on the notes.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The decision to brief.' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

// The API speaks raw token units; the model should see dollars.
const usd = (raw: number) => `$${(raw / 10 ** TOKEN_DECIMALS).toFixed(2)}`;
const explorer = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

interface ToolContext {
  origin: string;
  token?: string;
  agentId?: string;
}

function tokenFrom(request: Request): string | undefined {
  const header = request.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return (
    new URL(request.url).searchParams.get('token') ??
    request.headers.get('x-agent-token') ??
    undefined
  );
}

async function api(
  context: ToolContext,
  path: string,
  body?: unknown,
  extra: Record<string, string> = {},
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (context.token) headers['x-agent-token'] = context.token;
  Object.assign(headers, extra);
  try {
    const response = await fetch(`${context.origin}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(55_000),
    });
    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 400) };
    }
    return { ok: response.ok, status: response.status, data: json };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: `could not reach Stipend: ${error instanceof Error ? error.message : error}` },
    };
  }
}

const lastSignals = new Map<string, unknown>();
const lastNotes = new Map<string, unknown>();

async function buy(context: ToolContext, serviceId: string, body: Record<string, unknown>) {
  if (!context.agentId || !context.token) {
    return {
      ok: false,
      detail: 'this tool needs an agent token: send "Authorization: Bearer stp_..." or ?token=stp_...',
    } as const;
  }

  const ask = await api(context, `/api/paid/${serviceId}`, body);
  if (ask.status !== 402) {
    return {
      ok: ask.ok,
      data: ask.data,
      price: null,
      receipt: null,
      detail: ask.ok ? null : `vendor returned ${ask.status}`,
    } as const;
  }

  const quote = ask.data.accepts;
  const auth = await api(context, `/api/agents/${context.agentId}/authorize`, {
    serviceId: quote.serviceId,
    query: body.query,
  });
  if (!auth.ok) {
    const reason = auth.data?.reason ?? auth.data?.error ?? `authorize returned ${auth.status}`;
    return { ok: false, refused: true, detail: `refused by policy: ${reason}`, price: quote.price } as const;
  }

  const paid = await api(context, `/api/paid/${serviceId}`, body, { 'x-payment': auth.data.header });
  if (!paid.ok) {
    return {
      ok: false,
      detail: `vendor rejected the payment (${paid.status}): ${paid.data?.error ?? 'unknown'}`,
      price: quote.price,
      receipt: { signature: auth.data.signature },
    } as const;
  }

  return {
    ok: true,
    data: paid.data,
    price: quote.price,
    receipt: { signature: auth.data.signature, settleMs: auth.data.settleMs },
  } as const;
}

function receiptLine(result: { receipt?: { signature?: string; settleMs?: number } | null; price?: number | null }) {
  if (!result.receipt?.signature) return '';
  const settle = result.receipt.settleMs ? `, settled in ${result.receipt.settleMs}ms` : '';
  return `\n\n— paid ${usd(result.price ?? 0)}${settle}\n  ${explorer(result.receipt.signature)}`;
}

const text = (value: string, isError = false) => ({
  content: [{ type: 'text', text: value }],
  ...(isError ? { isError: true } : {}),
});

async function callTool(name: string, args: Record<string, unknown>, context: ToolContext) {
  if (name === 'agent_status') {
    if (!context.agentId || !context.token) {
      return text('add your agent token: Authorization: Bearer stp_... (the console shows it)', true);
    }
    const status = await api(context, `/api/agents/${context.agentId}/status`);
    if (!status.ok) {
      return text(`could not read agent status: ${status.data?.error ?? status.status}`, true);
    }
    const s = status.data;
    const lines = [
      `agent ${s.agent.name} (${s.agent.id})`,
      `balance ${usd(s.agent.balance)} dUSD · spent today ${usd(s.spentToday)} of ${usd(s.agent.policy.dailyCap)}`,
      `per-call cap ${usd(s.agent.policy.perCallCap)} · ${s.callsLeft} calls left at cap`,
      `allowlist: ${s.agent.policy.allowlist.length ? s.agent.policy.allowlist.join(', ') : 'any vendor'}`,
      '',
      'services:',
      ...s.services.map((service: { name: string; price: number; blurb: string }) => `  ${service.name} — ${usd(service.price)} — ${service.blurb}`),
    ];
    return text(lines.join('\n'));
  }

  const key = context.agentId ?? 'anon';
  const query = String(args?.query ?? '').slice(0, 300);

  if (name === 'buy_signals') {
    const result = await buy(context, 'market-intel', { query });
    if (!result.ok) return text(result.detail ?? 'purchase failed', true);
    const output = (result.data as any)?.output;
    lastSignals.set(key, output);
    const signals = output?.signals ?? [];
    const header = `${signals.length} live signals (${output?.source ?? 'live'}) for "${query}"`;
    const body = signals
      .map(
        (signal: any, index: number) =>
          `${index + 1}. ${signal.title} — ${signal.points} pts, ${signal.comments} comments (${signal.date})\n   ${signal.discussion}`,
      )
      .join('\n');
    return text(`${header}\n\n${body}${receiptLine(result)}`);
  }

  if (name === 'buy_notes') {
    const result = await buy(context, 'summarize', { query, context: lastSignals.get(key) ?? null });
    if (!result.ok) return text(result.detail ?? 'purchase failed', true);
    const output = (result.data as any)?.output;
    lastNotes.set(key, output);
    const notes = output?.notes ?? [];
    const engine = (result.data as any)?.engine === 'model' ? `written by ${(result.data as any).model}` : 'computed deterministically';
    return text(
      `${notes.length} notes (${engine}):\n\n${notes.map((note: string, index: number) => `${index + 1}. ${note}`).join('\n')}${receiptLine(result)}`,
    );
  }

  if (name === 'buy_brief') {
    const result = await buy(context, 'brief-writer', {
      query,
      context: lastNotes.get(key) ?? lastSignals.get(key) ?? null,
    });
    if (!result.ok) return text(result.detail ?? 'purchase failed', true);
    const output = (result.data as any)?.output;
    const engine = (result.data as any)?.engine === 'model' ? `written by ${(result.data as any).model}` : 'computed deterministically';
    return text(`memo (${engine}):\n\n${output?.memo ?? ''}${receiptLine(result)}`);
  }

  return text(`unknown tool: ${name}`, true);
}

async function dispatch(message: RpcMessage, context: ToolContext) {
  const { id, method, params } = message;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0' as const,
      id,
      result: {
        protocolVersion: (params?.protocolVersion as string) ?? PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'stipend', version: '0.1.0', title: 'Stipend' },
      },
    };
  }

  if (method === 'notifications/initialized' || method === 'initialized') return null;

  if (method === 'ping') return { jsonrpc: '2.0' as const, id, result: {} };

  if (method === 'tools/list') return { jsonrpc: '2.0' as const, id, result: { tools: TOOLS } };

  if (method === 'tools/call') {
    const name = String(params?.name ?? '');
    try {
      const result = await callTool(name, (params?.arguments as Record<string, unknown>) ?? {}, context);
      return { jsonrpc: '2.0' as const, id, result };
    } catch (error) {
      return {
        jsonrpc: '2.0' as const,
        id,
        error: { code: -32603, message: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  if (message.id === undefined) return null;
  return {
    jsonrpc: '2.0' as const,
    id,
    error: { code: -32601, message: `method not found: ${method}` },
  };
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  if (!raw) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } },
      { status: 400 },
    );
  }

  const token = tokenFrom(request);
  const agent = token ? await agentByToken(token) : undefined;

  const context: ToolContext = {
    origin: new URL(request.url).origin,
    token,
    agentId: agent?.id,
  };

  const messages: RpcMessage[] = Array.isArray(raw) ? raw : [raw];
  const replies: unknown[] = [];
  for (const message of messages) {
    const response = await dispatch(message, context);
    if (response) replies.push(response);
  }

  if (replies.length === 0) {
    return new Response(null, { status: 202 });
  }

  return NextResponse.json(Array.isArray(raw) ? replies : replies[0], {
    headers: { 'cache-control': 'no-store' },
  });
}

/**
 * Some clients probe with GET to open a server-sent-events channel. This server
 * answers every request on POST, so say so instead of pretending to stream.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'this MCP endpoint speaks JSON-RPC over POST',
      hint: 'POST {"jsonrpc":"2.0","id":1,"method":"initialize",...} to this URL',
    },
    { status: 405, headers: { allow: 'POST' } },
  );
}
