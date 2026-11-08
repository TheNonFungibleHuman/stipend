import { complete, llmConfigured } from './llm';

/**
 * What the agent buys. Each service returns something a next step consumes, so
 * the run is a real pipeline rather than three unrelated API calls.
 *
 * The market dataset is synthetic demo data — a real deployment would pay a
 * real data vendor through exactly this flow.
 */
export interface Competitor {
  name: string;
  monthly: number;
  positioning: string;
}

export interface MarketIntel {
  category: string;
  competitors: Competitor[];
  medianMonthly: number;
  cheapest: string;
}

export interface Notes {
  notes: string[];
  spread: number;
}

export interface Brief {
  title: string;
  memo: string;
}

const MARKET_DATA: Record<string, MarketIntel> = {
  'ai-observability': {
    category: 'AI observability',
    competitors: [
      { name: 'Langfuse', monthly: 59, positioning: 'open-source first, self-host upsell' },
      { name: 'Helicone', monthly: 20, positioning: 'cheap gateway, usage-based' },
      { name: 'Braintrust', monthly: 249, positioning: 'eval-led, enterprise pilots' },
      { name: 'Arize', monthly: 399, positioning: 'ML platform incumbents' },
      { name: 'LangSmith', monthly: 39, positioning: 'bundled with the framework' },
    ],
    medianMonthly: 59,
    cheapest: 'Helicone',
  },
  'agent-payments': {
    category: 'Agent payments',
    competitors: [
      { name: 'Skyfire', monthly: 0, positioning: 'per-transaction, KYB onboarding' },
      { name: 'Payman', monthly: 0, positioning: 'human-approved agent payouts' },
      { name: 'Coinbase x402', monthly: 0, positioning: 'protocol, not a product' },
      { name: 'Stripe SPT', monthly: 0, positioning: 'card rails, high minimum ticket' },
    ],
    medianMonthly: 0,
    cheapest: 'Coinbase x402',
  },
};

function marketFor(query: string): MarketIntel {
  const key = Object.keys(MARKET_DATA).find((candidate) => query.toLowerCase().includes(candidate.split('-')[0]));
  return MARKET_DATA[key ?? 'agent-payments'];
}

export interface ServiceResult {
  serviceId: string;
  output: MarketIntel | Notes | Brief | { text: string };
  engine: 'model' | 'deterministic';
  model?: string;
  computeMs: number;
}

/**
 * The caller passes whatever the previous step bought. Never trust its shape:
 * a summariser output is not a market-intel payload, and a 500 in the middle of
 * a paid chain is a worse failure than falling back to the known dataset.
 */
function asMarketIntel(value: unknown, query: string): MarketIntel {
  const candidate = value as MarketIntel | null | undefined;
  if (
    candidate &&
    Array.isArray(candidate.competitors) &&
    candidate.competitors.length > 0 &&
    typeof candidate.category === 'string'
  ) {
    return candidate;
  }
  return marketFor(query);
}

function notesFrom(value: unknown): string[] {
  const candidate = value as { notes?: unknown } | null | undefined;
  if (candidate && Array.isArray(candidate.notes)) {
    return candidate.notes.filter((note): note is string => typeof note === 'string').slice(0, 6);
  }
  return [];
}

export async function runService(
  serviceId: string,
  context: { query: string; intel?: unknown },
): Promise<ServiceResult> {
  const started = Date.now();
  const intel = asMarketIntel(context.intel, context.query);
  const notes = notesFrom(context.intel);

  if (serviceId === 'market-intel') {
    // Buying data: the value is the dataset, so no model is involved.
    return {
      serviceId,
      output: intel,
      engine: 'deterministic',
      computeMs: Date.now() - started,
    };
  }

  if (serviceId === 'summarize') {
    if (llmConfigured()) {
      const result = await complete({
        system:
          'You are a research analyst. Return 3-4 short bullet points of decision-grade insight. ' +
          'No preamble, no headings, no markdown bold. Each bullet under 22 words.',
        user: `Competitor data (monthly price in USD, positioning):\n${JSON.stringify(intel, null, 2)}\n\n` +
          `Goal: ${context.query}\n\nWrite the bullets.`,
        maxTokens: 400,
      });
      if (result) {
        return {
          serviceId,
          output: { notes: bullets(result.text), spread: spreadOf(intel) },
          engine: 'model',
          model: result.model,
          computeMs: Date.now() - started,
        };
      }
    }
    return {
      serviceId,
      output: { notes: deterministicNotes(intel), spread: spreadOf(intel) },
      engine: 'deterministic',
      computeMs: Date.now() - started,
    };
  }

  if (serviceId === 'brief-writer') {
    const source = notes.length > 0 ? `Notes the agent already bought:\n${notes.join('\n')}` : '';
    if (llmConfigured()) {
      const result = await complete({
        system:
          'You write one-page memos for operators. Plain prose, 120 words max, no markdown, no preamble. ' +
          'Open with the recommendation, then the reasoning, then the risk.',
        user: `Goal: ${context.query}\n\nCompetitor data:\n${JSON.stringify(intel, null, 2)}\n\n${source}\n\nWrite the memo.`,
        maxTokens: 500,
      });
      if (result) {
        return {
          serviceId,
          output: { title: `Memo — ${intel.category}`, memo: result.text },
          engine: 'model',
          model: result.model,
          computeMs: Date.now() - started,
        };
      }
    }
    return {
      serviceId,
      output: { title: `Memo — ${intel.category}`, memo: deterministicMemo(intel, context.query) },
      engine: 'deterministic',
      computeMs: Date.now() - started,
    };
  }

  return {
    serviceId,
    output: { text: `no implementation for ${serviceId}` },
    engine: 'deterministic',
    computeMs: Date.now() - started,
  };
}

function bullets(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-*•\d.\s]+/, '').trim())
    .filter((line) => line.length > 12)
    .slice(0, 5);
}

function spreadOf(intel: MarketIntel): number {
  const prices = intel.competitors.map((competitor) => competitor.monthly).filter((price) => price > 0);
  if (prices.length < 2) return 0;
  return Math.round((Math.max(...prices) / Math.min(...prices)) * 10) / 10;
}

function deterministicNotes(intel: MarketIntel): string[] {
  const sorted = [...intel.competitors].sort((a, b) => a.monthly - b.monthly);
  const paid = sorted.filter((competitor) => competitor.monthly > 0);
  const notes = [
    `${intel.category} prices span ${spreadOf(intel)}x, from $${paid[0]?.monthly ?? 0} to $${paid[paid.length - 1]?.monthly ?? 0} a month.`,
    `Median list price sits at $${intel.medianMonthly}; the cheapest credible option is ${intel.cheapest}.`,
  ];
  if (sorted.some((competitor) => competitor.monthly === 0)) {
    notes.push('Free tiers are a land-grab: charging for seats is not what wins here.');
  }
  notes.push(
    `${intel.competitors.length} vendors, none priced per outcome — the gap is usage-based pricing.`,
  );
  return notes;
}

function deterministicMemo(intel: MarketIntel, query: string): string {
  const sorted = [...intel.competitors].sort((a, b) => a.monthly - b.monthly);
  const paid = sorted.filter((competitor) => competitor.monthly > 0);
  return (
    `Recommendation: enter ${intel.category} below the $${intel.medianMonthly} median and charge per outcome, not per seat. ` +
    `The market splits into free-tier land grabs (${sorted.filter((c) => c.monthly === 0).length} of ${sorted.length} vendors) ` +
    `and seats above $${paid[paid.length - 1]?.monthly ?? 0}. Nothing here is priced per result, which is exactly where ` +
    `an agent-paid product wins: the buyer pays cents per answer and the seller keeps the whole margin. ` +
    `Risk: ${intel.cheapest} can copy outcome pricing in a release cycle; the defensible part is the payment rail and the audit trail, not the model. ` +
    `Original ask: "${query}".`
  );
}
