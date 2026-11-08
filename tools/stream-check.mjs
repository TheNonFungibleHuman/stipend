/**
 * Verifies POST /api/run streams newline-delimited JSON events.
 * Usage: node tools/stream-check.mjs [baseUrl]
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4310';

const stateRes = await fetch(`${base}/api/state`);
const state = await stateRes.json();
const agentId = state.activeAgentId;
console.log(`state ok=${state.ok} agent=${state.snapshot?.agent?.name} balance=${state.snapshot?.agent?.tokensRaw}`);

const started = Date.now();
const res = await fetch(`${base}/api/run`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    goal: 'Should we launch usage-based pricing for our AI observability product?',
    agentId,
  }),
});

console.log(`POST -> ${res.status} ${res.headers.get('content-type')}`);
if (!res.body) throw new Error('no response body');

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let lines = 0;
let lastRun = null;
const seen = [];

for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    lines += 1;
    const event = JSON.parse(line);
    const at = ((Date.now() - started) / 1000).toFixed(1);
    if (event.type === 'error') console.log(`  ${at}s ERROR ${event.message}`);
    const steps = event.run?.steps ?? [];
    const shape = steps.map((s) => `${s.index}:${s.status}`).join(' ');
    console.log(`  ${at}s ${event.type} status=${event.run?.status ?? '-'} [${shape}]`);
    seen.push(shape);
    if (event.type === 'done' || event.type === 'run') lastRun = event.run;
  }
}

const total = ((Date.now() - started) / 1000).toFixed(1);
console.log('---');
console.log(`lines=${lines} total=${total}s`);
if (!lastRun) { console.log('FAIL: no run event'); process.exit(1); }
console.log(`final status=${lastRun.status} steps=${lastRun.steps.length}`);
for (const s of lastRun.steps) {
  console.log(`  ${s.index} ${s.serviceName.padEnd(16)} ${s.status.padEnd(8)} engine=${s.engine ?? '-'} compute=${s.computeMs ?? '-'}ms settle=${s.settleMs ?? '-'}ms`);
}
const ok = lastRun.steps.length === 3 && lastRun.steps.every((s) => s.status === 'settled');
console.log(ok ? 'PASS: 3/3 settled, streamed' : 'FAIL: incomplete run');
process.exit(ok ? 0 : 1);
