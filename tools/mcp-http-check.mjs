/**
 * Exercises the hosted MCP endpoint the way a real client does:
 * initialize → tools/list → tools/call.
 *
 * Usage: node tools/mcp-http-check.mjs [baseUrl]
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4310';
const state = await (await fetch(`${base}/api/state`)).json();
const agentId = state.activeAgentId ?? state.snapshot?.agent?.id;
const agents = state.agents ?? [];
const agent = agents.find((a) => a.id === agentId) ?? agents[0];
const token = agent?.token;

if (!token) {
  console.log('no owner token in /api/state (expected for view-only pages)');
  process.exit(1);
}

async function rpc(body, expectStatus = 200) {
  const res = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.status !== expectStatus) {
    console.log(`  unexpected status ${res.status}: ${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : null;
}

const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'check', version: '1' } } });
console.log('initialize:', init?.result?.serverInfo?.name, init?.result?.protocolVersion);

await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, 202);

const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
console.log('tools:', (list?.result?.tools ?? []).map((t) => t.name).join(', '));

const status = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'agent_status', arguments: {} } });
console.log('agent_status:', (status?.result?.content?.[0]?.text ?? '').split('\n').slice(0, 2).join(' | '));

const signals = await rpc({
  jsonrpc: '2.0',
  id: 4,
  method: 'tools/call',
  params: { name: 'buy_signals', arguments: { query: 'usage-based pricing for AI observability' } },
});
const signalsText = signals?.result?.content?.[0]?.text ?? '';
console.log('buy_signals:', signalsText.split('\n')[0]);
const tx = signalsText.match(/https:\/\/explorer\.solana\.com\/tx\/(\w+)/);
console.log('  receipt:', tx ? `paid, tx ${tx[1].slice(0, 12)}…` : 'no receipt in text');

const missing = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'buy_brief', arguments: { query: 'x' } } });
console.log('idempotent second call ok:', Boolean(missing?.result));

const ok = Boolean(init?.result) && (list?.result?.tools ?? []).length === 4 && signalsText.includes('live signals');
console.log(ok ? 'PASS: hosted MCP works over HTTP' : 'FAIL');
process.exit(ok ? 0 : 1);
