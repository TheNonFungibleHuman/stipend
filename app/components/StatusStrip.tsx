'use client';

import type { LedgerEntry, Policy } from '../types';
import { usd } from '../types';

interface Props {
  spentToday: number;
  policy?: Policy;
  agentTokens: number;
  ledger: LedgerEntry[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/** The numbers an operator checks first. No prose, one line per fact. */
export function StatusStrip({ spentToday, policy, agentTokens, ledger }: Props) {
  const settled = ledger.filter((entry) => entry.decision === 'settled');
  const refused = ledger.filter((entry) => entry.decision === 'refused');
  const errors = ledger.filter((entry) => entry.decision === 'error');
  const remaining = Math.max(0, (policy?.dailyCap ?? 0) - spentToday);
  const callsLeft = policy?.perCallCap ? Math.floor(remaining / policy.perCallCap) : 0;
  const medianSettle = median(
    settled.map((entry) => entry.settleMs).filter((value): value is number => typeof value === 'number'),
  );

  const metrics: Array<{ k: string; v: string; tone?: 'ok' | 'warn' | 'stop'; sub?: string }> = [
    { k: 'Spent today', v: usd(spentToday), sub: `of ${usd(policy?.dailyCap ?? 0)}` },
    { k: 'Budget left', v: usd(remaining), sub: `${callsLeft} calls at cap` },
    { k: 'Agent balance', v: usd(agentTokens), tone: agentTokens < 1_000_000 ? 'warn' : undefined },
    { k: 'Paid calls', v: String(settled.length), tone: 'ok', sub: `${refused.length} refused` },
    { k: 'Settle time', v: medianSettle === null ? '—' : `${medianSettle}ms`, sub: 'median, last 60' },
    { k: 'Errors', v: String(errors.length), tone: errors.length > 0 ? 'stop' : undefined },
  ];

  return (
    <section className="status" aria-label="Agent status">
      {metrics.map((metric) => (
        <div className="status__cell" key={metric.k}>
          <span className="status__k">{metric.k}</span>
          <span className={`status__v${metric.tone ? ` status__v--${metric.tone}` : ''}`}>
            {metric.v}
          </span>
          {metric.sub && <span className="status__sub">{metric.sub}</span>}
        </div>
      ))}
    </section>
  );
}
