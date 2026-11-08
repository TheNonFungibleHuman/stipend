import { DEFAULT_POLICY, HOSTILE_SERVICE, SERVICES, TOKEN_DECIMALS } from './config';
import type { ChainSnapshot } from './bootstrap';
import type { LedgerEntry } from './store';
import type { Run, RunStep } from './agent';

/**
 * Fixture mode. `STIPEND_FIXTURE=1` serves a recorded session instead of devnet
 * so the interface can be built, screenshotted and reviewed without funding a
 * wallet — and so a demo has a floor if devnet has a bad minute. It is off by
 * default, and the UI marks it.
 */
const now = Date.now();
const at = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString();

const MINT = '9xQeWvG816bUx9EPjHmaT23yvVM3UHn5ZmvSj2Z6nGmU';
const TREASURY = '5qgRDGNrgqx9gzvsYzVgMaFsgfjPQ3thDDBt3syH4Ton';
const AGENT = '7YttLkHDoNj9wyDur5PMy4xeiXKtDGmNR9tLZ8mZ1ZxK';
const PROVIDERS = ['4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', '3h4xX2Y7q9yTnM8sVb1kLpRf6gWcE5uAdJ2oK9mNqRsT'];
const SIGS = [
  '5j7s6NiJS3JAkvgkocdQrbZ3UYcF7GLVK3kFqE2mYp4Za8mQ1yVdPwXfTbHnUcRgEjSoLzDvAiK6tWb9YhMNq2rP',
  '3mLkP8tQvX2bYrNcJhFzSdWgAeU7pRiKo6sTnM4yDqLxVbC1jHfE9aZwGmRkP5uYtSxNdBoQvIcLh2FgJw',
  '4xR2tKpQbYvNcMdFhJzSgW7eUaRiLoP8nDqTsM6yVxLkC1jHfE3bZwGmRkP9uYdSxNtBoQvIcLhF5gJwTr',
];

export const FIXTURE_MINT = MINT;

export function fixtureSnapshot(): ChainSnapshot {
  return {
    mint: MINT,
    mintSymbol: 'dUSD',
    decimals: TOKEN_DECIMALS,
    rpcHost: 'api.devnet.solana.com',
    network: 'devnet',
    treasury: { address: TREASURY, sol: 0.483, tokensRaw: 0 },
    agent: { address: AGENT, tokensRaw: 24_940_000 },
    providers: SERVICES.map((service, index) => ({
      id: service.id,
      address: PROVIDERS[index],
      tokensRaw: 1_240_000 + index * 60_000,
    })),
    policy: { ...DEFAULT_POLICY },
    ready: true,
  };
}

const normalSteps: RunStep[] = [
  {
    index: 0,
    serviceId: 'market-intel',
    serviceName: 'Market Intel',
    price: 40_000,
    status: 'settled',
    signature: SIGS[0],
    settleMs: 412,
    verifyMs: 186,
    engine: 'deterministic',
    cardFee: 31_160,
    startedAt: at(22),
    endedAt: at(20),
    quote: {
      scheme: 'exact',
      network: 'solana:devnet',
      serviceId: 'market-intel',
      price: 40_000,
      payee: PROVIDERS[0],
      mint: MINT,
    },
    output: {
      category: 'AI observability',
      medianMonthly: 59,
      cheapest: 'Helicone',
      competitors: [
        { name: 'Langfuse', monthly: 59, positioning: 'open-source first' },
        { name: 'Helicone', monthly: 20, positioning: 'cheap gateway' },
        { name: 'Braintrust', monthly: 249, positioning: 'eval-led' },
        { name: 'Arize', monthly: 399, positioning: 'platform incumbents' },
        { name: 'LangSmith', monthly: 39, positioning: 'bundled with framework' },
      ],
    },
  },
  {
    index: 1,
    serviceId: 'summarize',
    serviceName: 'Summarizer',
    price: 60_000,
    status: 'settled',
    signature: SIGS[1],
    settleMs: 388,
    verifyMs: 204,
    engine: 'deterministic',
    cardFee: 31_740,
    startedAt: at(18),
    endedAt: at(16),
    quote: {
      scheme: 'exact',
      network: 'solana:devnet',
      serviceId: 'summarize',
      price: 60_000,
      payee: PROVIDERS[1],
      mint: MINT,
    },
    output: {
      notes: [
        'AI observability prices span 19.9x, from $20 to $399 a month.',
        'Median list price sits at $59; the cheapest credible option is Helicone.',
        'Free tiers are a land-grab: charging for seats is not what wins here.',
        'Five vendors, none priced per outcome — the gap is usage-based pricing.',
      ],
      spread: 19.9,
    },
  },
  {
    index: 2,
    serviceId: 'brief-writer',
    serviceName: 'Brief Writer',
    price: 80_000,
    status: 'settled',
    signature: SIGS[2],
    settleMs: 401,
    verifyMs: 191,
    engine: 'deterministic',
    cardFee: 32_320,
    startedAt: at(14),
    endedAt: at(12),
    quote: {
      scheme: 'exact',
      network: 'solana:devnet',
      serviceId: 'brief-writer',
      price: 80_000,
      payee: PROVIDERS[2],
      mint: MINT,
    },
    output: {
      title: 'Memo — AI observability',
      memo:
        'Recommendation: enter AI observability below the $59 median and charge per outcome, not per seat. Two of five vendors give the product away to win the install; the other three charge $59 to $399 a seat. Nothing here is priced per result, which is exactly where an agent-paid product wins: the buyer pays cents per answer and the seller keeps the whole margin. Risk: Helicone can copy outcome pricing in one release cycle, so the defensible part is the payment rail and the audit trail, not the model.',
    },
  },
];

export function fixtureRun(mode: 'normal' | 'rogue' = 'normal'): Run {
  if (mode === 'rogue') {
    return {
      id: 'rogue001',
      goal: 'Buy premium competitor data at any price.',
      mode: 'rogue',
      status: 'complete',
      startedAt: at(9),
      endedAt: at(7),
      engine: 'deterministic',
      policy: { ...DEFAULT_POLICY },
      spend: 40_000,
      refused: 1,
      steps: [
        {
          index: 0,
          serviceId: HOSTILE_SERVICE.id,
          serviceName: HOSTILE_SERVICE.name,
          price: HOSTILE_SERVICE.price,
          status: 'denied',
          reason: '$5.00 is over the $0.10 per-call cap',
          cardFee: 175_000,
          startedAt: at(8),
          endedAt: at(7),
          quote: {
            scheme: 'exact',
            network: 'solana:devnet',
            serviceId: HOSTILE_SERVICE.id,
            price: HOSTILE_SERVICE.price,
            payee: PROVIDERS[0],
            mint: MINT,
          },
        },
        { ...normalSteps[0], index: 1, startedAt: at(6), endedAt: at(4) },
      ],
    };
  }

  return {
    id: 'run00001',
    goal: 'Should we launch usage-based pricing for our AI observability product, and at what price?',
    mode: 'normal',
    status: 'complete',
    startedAt: at(23),
    endedAt: at(11),
    engine: 'deterministic',
    policy: { ...DEFAULT_POLICY },
    spend: 180_000,
    refused: 0,
    steps: normalSteps,
    verdict: (normalSteps[2].output as { memo: string }).memo,
  };
}

export function fixtureLedger(): LedgerEntry[] {
  return [
    {
      id: 'run00001-2',
      runId: 'run00001',
      at: at(12),
      serviceId: 'brief-writer',
      serviceName: 'Brief Writer',
      price: 80_000,
      decision: 'settled',
      signature: SIGS[2],
      settleMs: 401,
      agentBalanceAfter: 24_760_000,
      cardFee: 32_320,
    },
    {
      id: 'run00001-1',
      runId: 'run00001',
      at: at(16),
      serviceId: 'summarize',
      serviceName: 'Summarizer',
      price: 60_000,
      decision: 'settled',
      signature: SIGS[1],
      settleMs: 388,
      agentBalanceAfter: 24_840_000,
      cardFee: 31_740,
    },
    {
      id: 'premium-0',
      runId: 'rogue001',
      at: at(180),
      serviceId: HOSTILE_SERVICE.id,
      serviceName: HOSTILE_SERVICE.name,
      price: HOSTILE_SERVICE.price,
      decision: 'refused',
      reason: '$5.00 is over the $0.10 per-call cap',
      agentBalanceAfter: 24_900_000,
      cardFee: 175_000,
    },
    {
      id: 'run00001-0',
      runId: 'run00001',
      at: at(20),
      serviceId: 'market-intel',
      serviceName: 'Market Intel',
      price: 40_000,
      decision: 'settled',
      signature: SIGS[0],
      settleMs: 412,
      agentBalanceAfter: 24_900_000,
      cardFee: 31_160,
    },
  ];
}
