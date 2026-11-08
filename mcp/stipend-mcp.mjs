#!/usr/bin/env node
/**
 * Stipend MCP server.
 *
 * Lets an existing agent — Claude Code, Cursor, opencode, antigravity, anything
 * that speaks Model Context Protocol — buy Stipend's paid services as tools.
 * The 402 → authorize → retry handshake happens in here, so the calling agent
 * just sees a normal tool result.
 *
 * env:
 *   STIPEND_URL           default http://127.0.0.1:4310 (hosted: https://stipend-delta.vercel.app)
 *   STIPEND_AGENT_ID      the agent id from the console
 *   STIPEND_AGENT_TOKEN   that agent's API token
 *
 * transport: stdio, newline-delimited JSON-RPC (Content-Length framing is also
 * accepted, because a few clients still send it).
 */
import { createInterface } from 'node:readline';

const BASE = (process.env.STIPEND_URL ?? 'http://127.0.0.1:4310').replace(/\/$/, '');
const AGENT_ID = process.env.STIPEND_AGENT_ID ?? '';
const TOKEN = process.env.STIPEND_AGENT_TOKEN ?? '';
const PROTOCOL = '2024-11-05';

const usd = (base) => `$${(base / 1_000_000).toFixed(2)}`;
const explorer = (signature) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

/* ------------------------------------------------------------------ transport */

let buffer = '';

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  if (id === undefined || id === null) return;
  send({ jsonrpc: '2.0', id, result });
}

function fail(id, code, message) {
  if (id === undefined || id === null) return;
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function consume() {
  // Content-Length framed message?
  if (buffer.startsWith('Content-Length:')) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;
    const length = Number(buffer.slice(0, headerEnd).split(':')[1]);
    const start = headerEnd + 4;
    if (buffer.length < start + length) return;
    const body = buffer.slice(start, start + length);
    buffer = buffer.slice(start + length);
    handle(body);
    consume();
    return;
  }

  // Newline-delimited.
  let index;
  while ((index = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) handle(line);
  }
}

function handle(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  void dispatch(message);
}

/* --------------------------------------------------------------------- wallet */

async function api(path, body, extraHeaders = {}) {
  const headers = { 'content-type': 'application/json' };
  if (TOKEN) headers['x-agent-token'] = TOKEN;
  Object.assign(headers, extraHeaders);
  try {
    const response = await fetch(`${BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 400) };
    }
    return { ok: response.ok, status: response.status, data: json };
  } catch (error) {
    return { ok: false, status: 0, data: { error: `could not reach Stipend at ${BASE}: ${error.message}` } };
  }
}

function configError() {
  if (!AGENT_ID) return 'STIPEND_AGENT_ID is not set.';
  if (!TOKEN) return 'STIPEND_AGENT_TOKEN is not set.';
  return null;
}

/**
 * The whole point: ask, get a 402, ask the wallet service to authorise it
 * against the caps, retry with proof. The caller never sees the handshake.
 */
async function buy(serviceId, body) {
  const problem = configError();
  if (problem) return { ok: false, detail: problem };

  const ask = await api(`/api/paid/${serviceId}`, body);
  if (ask.status !== 402) {
    return { ok: ask.ok, data: ask.data, price: null, receipt: null, detail: ask.ok ? null : `vendor returned ${ask.status}` };
  }

  const quote = ask.data.accepts;
  const auth = await api(`/api/agents/${AGENT_ID}/authorize`, { serviceId: quote.serviceId, query: body.query });
  if (!auth.ok) {
    const reason = auth.data?.reason ?? auth.data?.error ?? `authorize returned ${auth.status}`;
    return { ok: false, refused: true, detail: `refused by policy: ${reason}`, price: quote.price };
  }

  const paid = await api(`/api/paid/${serviceId}`, body, { 'x-payment': auth.data.header });
  if (!paid.ok) {
    return {
      ok: false,
      detail: `vendor rejected the payment (${paid.status}): ${paid.data?.error ?? 'unknown'}`,
      price: quote.price,
      receipt: { signature: auth.data.signature },
    };
  }

  return {
    ok: true,
    data: paid.data,
    price: quote.price,
    receipt: { signature: auth.data.signature, settleMs: auth.data.settleMs },
  };
}

function receiptLine(result) {
  if (!result.receipt?.signature) return '';
  const settle = result.receipt.settleMs ? `, settled in ${result.receipt.settleMs}ms` : '';
  return `\n\n— paid ${usd(result.price ?? 0)}${settle}\n  ${explorer(result.receipt.signature)}`;
}

/* ---------------------------------------------------------------------- tools */

const TOOLS = [
  {
    name: 'agent_status',
    description:
      'Check this agent\'s wallet: balance, per-call cap, daily budget, how much is left today, and the price of each service. Call this before buying if you are unsure whether you can afford a purchase.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'buy_signals',
    description:
      'Buy live public discussion (Hacker News) about a topic. Costs about $0.04 from the agent wallet. Returns real, current threads with points and dates. Use this when you need to know what people are actually saying rather than what a model remembers.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The topic to search for, e.g. "usage-based pricing for developer tools".' },
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
      properties: {
        query: { type: 'string', description: 'The question the notes should answer.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'buy_brief',
    description:
      'Buy a one-page memo that opens with a recommendation, then the reasoning, then the risk. Costs about $0.08. Use it when the user asked for a written recommendation, not raw notes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The goal the memo should address.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

// Remember what was bought so a follow-up step reuses it instead of re-fetching.
let lastSignals = null;
let lastNotes = null;

async function callTool(name, args) {
  if (name === 'agent_status') {
    const problem = configError();
    if (problem) return { content: [{ type: 'text', text: problem }], isError: true };
    const status = await api(`/api/agents/${AGENT_ID}/status`);
    if (!status.ok) {
      return { content: [{ type: 'text', text: `could not read agent status: ${status.data?.error ?? status.status}` }], isError: true };
    }
    const s = status.data;
    const lines = [
      `agent ${s.agent.name} (${s.agent.id})`,
      `balance ${usd(s.agent.balance)} dUSD · spent today ${usd(s.spentToday)} of ${usd(s.agent.policy.dailyCap)}`,
      `per-call cap ${usd(s.agent.policy.perCallCap)} · ${s.callsLeft} calls left at cap`,
      `allowlist: ${s.agent.policy.allowlist.length ? s.agent.policy.allowlist.join(', ') : 'any vendor'}`,
      '',
      'services:',
      ...s.services.map((service) => `  ${service.name} — ${usd(service.price)} — ${service.blurb}`),
    ];
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  if (name === 'buy_signals') {
    const result = await buy('market-intel', { query: String(args?.query ?? '').slice(0, 300) });
    if (!result.ok) return { content: [{ type: 'text', text: result.detail }], isError: true };
    lastSignals = result.data.output;
    const signals = result.data.output?.signals ?? [];
    const header = `${signals.length} live signals (${result.data.output?.source ?? 'live'}) for "${args?.query ?? ''}" — ${result.data.note ?? ''}`;
    const body = signals
      .map((signal, index) => `${index + 1}. ${signal.title} — ${signal.points} pts, ${signal.comments} comments (${signal.date})\n   ${signal.discussion}`)
      .join('\n');
    return { content: [{ type: 'text', text: `${header}\n\n${body}${receiptLine(result)}` }] };
  }

  if (name === 'buy_notes') {
    const result = await buy('summarize', {
      query: String(args?.query ?? '').slice(0, 300),
      context: lastSignals ?? null,
    });
    if (!result.ok) return { content: [{ type: 'text', text: result.detail }], isError: true };
    lastNotes = result.data.output;
    const notes = result.data.output?.notes ?? [];
    const engine = result.data.engine === 'model' ? `written by ${result.data.model}` : 'computed deterministically';
    return {
      content: [
        {
          type: 'text',
          text: `${notes.length} notes (${engine}):\n\n${notes.map((note, index) => `${index + 1}. ${note}`).join('\n')}${receiptLine(result)}`,
        },
      ],
    };
  }

  if (name === 'buy_brief') {
    const result = await buy('brief-writer', {
      query: String(args?.query ?? '').slice(0, 300),
      context: lastNotes ?? lastSignals ?? null,
    });
    if (!result.ok) return { content: [{ type: 'text', text: result.detail }], isError: true };
    const engine = result.data.engine === 'model' ? `written by ${result.data.model}` : 'computed deterministically';
    return {
      content: [{ type: 'text', text: `memo (${engine}):\n\n${result.data.output?.memo ?? ''}${receiptLine(result)}` }],
    };
  }

  return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
}

/* ---------------------------------------------------------------- dispatcher */

async function dispatch(message) {
  const { id, method, params } = message ?? {};

  if (method === 'initialize') {
    reply(id, {
      protocolVersion: params?.protocolVersion ?? PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'stipend', version: '0.1.0' },
    });
    return;
  }

  if (method === 'notifications/initialized' || method === 'initialized') return;
  if (method === 'ping') {
    reply(id, {});
    return;
  }
  if (method === 'tools/list') {
    reply(id, { tools: TOOLS });
    return;
  }
  if (method === 'tools/call') {
    const name = params?.name;
    try {
      reply(id, await callTool(name, params?.arguments ?? {}));
    } catch (error) {
      fail(id, -32603, error instanceof Error ? error.message : String(error));
    }
    return;
  }

  fail(id, -32601, `method not found: ${method}`);
}

const stdin = process.stdin;
stdin.setEncoding('utf8');
if (typeof createInterface === 'function') {
  stdin.on('data', (chunk) => {
    buffer += chunk;
    consume();
  });
}
stdin.on('end', () => process.exit(0));
