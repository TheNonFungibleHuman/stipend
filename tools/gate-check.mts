import { reviewQuery } from '../lib/guard.ts';

const cases = [
  'Recommend the best way to configure persistent agent memory for an AI agent',
  'Should we launch usage-based pricing for our AI observability product?',
  'usage-based pricing for AI observability tools',
  'what are competitors charging for observability',
  'how do I implement a vector database',
  'best editor for writing prose',
  'tell me a joke',
];

for (const query of cases) {
  const result = reviewQuery(query);
  console.log(`${result.allowed ? 'ALLOW' : 'BLOCK'} | ${query}`);
  if (!result.allowed) console.log(`        -> ${result.reason}`);
}
