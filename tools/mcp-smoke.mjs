/**
 * End-to-end proof that the MCP server works: spawn it exactly as a client
 * would, speak the protocol, and make one real purchase.
 *
 *   node tools/mcp-smoke.mjs
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const BASE = 'http://127.0.0.1:4310';

async function agentCredentials() {
  const state = await (await fetch(`${BASE}/api/state`)).json();
  const active = (state.agents ?? []).find((agent) => agent.id === state.activeAgentId);
  if (!active) throw new Error('no active agent from /api/state');
  return { agentId: active.id, token: active.token, name: active.name };
}

function client(env) {
  const child = spawn(process.execPath, ['mcp/stipend-mcp.mjs'], {
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  const pending = new Map();
  let nextId = 1;

  createInterface({ input: child.stdout }).on('line', (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    waiter(message);
  });

  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, resolve);
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 90_000);
    });

  const notify = (method, params) =>
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);

  return { child, request, notify };
}

const text = (result) => (result?.content ?? []).filter((part) => part.type === 'text').map((part) => part.text).join('\n');

async function main() {
  const { agentId, token, name } = await agentCredentials();
  console.log(`→ agent ${name} (${agentId})`);

  const { child, request, notify } = client({
    STIPEND_URL: BASE,
    STIPEND_AGENT_ID: agentId,
    STIPEND_AGENT_TOKEN: token,
  });

  const init = await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mcp-smoke', version: '1.0.0' },
  });
  console.log('→ initialize:', init.result?.serverInfo);

  notify('notifications/initialized');

  const list = await request('tools/list', {});
  console.log('→ tools:', (list.result?.tools ?? []).map((tool) => tool.name).join(', '));

  const status = await request('tools/call', { name: 'agent_status', arguments: {} });
  console.log('\n--- agent_status ---\n' + text(status.result));

  const signals = await request('tools/call', {
    name: 'buy_signals',
    arguments: { query: 'usage-based pricing for AI products' },
  });
  if (signals.result?.isError) {
    console.log('\n--- buy_signals FAILED ---\n' + text(signals.result));
  } else {
    console.log('\n--- buy_signals ---\n' + text(signals.result).slice(0, 900));
  }

  const notes = await request('tools/call', {
    name: 'buy_notes',
    arguments: { query: 'how should we price per call?' },
  });
  console.log('\n--- buy_notes ---\n' + text(notes.result).slice(0, 900));

  child.kill();
}

main().catch((error) => {
  console.error('MCP SMOKE FAILED:', error.message);
  process.exitCode = 1;
});
