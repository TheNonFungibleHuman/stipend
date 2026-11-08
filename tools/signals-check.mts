import { fetchSignals } from '../lib/vendors/signals.ts';

const goals = [
  'WhatsApp AI dispatcher best practice',
  'Should we launch usage-based pricing for our AI observability product?',
  'what are competitors charging for AI coding assistants',
];

for (const goal of goals) {
  const result = await fetchSignals(goal);
  console.log(`\n=== ${goal}`);
  console.log(`source=${result.source} queries=${JSON.stringify(result.queries)}`);
  console.log(`note: ${result.note}`);
  for (const signal of result.signals) {
    const bad = signal.url.includes('id=0') || signal.discussion.includes('id=0');
    console.log(`  ${bad ? 'BAD LINK' : 'ok'} ${signal.date} ${signal.points}pts ${signal.title.slice(0, 70)}`);
    console.log(`     ${signal.discussion}`);
  }
  if (result.signals.length === 0) console.log('  (no signals)');
}
