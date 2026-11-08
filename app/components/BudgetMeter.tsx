'use client';

import type { Policy } from '../types';
import { usd } from '../types';

interface Props {
  spentToday: number;
  policy?: Policy;
  agentTokens: number;
  runSpend: number;
}

export function BudgetMeter({ spentToday, policy, agentTokens, runSpend }: Props) {
  const dailyCap = policy?.dailyCap ?? 1_000_000;
  const perCallCap = policy?.perCallCap ?? 100_000;
  const spent = spentToday;
  const percent = dailyCap > 0 ? Math.min(100, (spent / dailyCap) * 100) : 0;
  const capPercent = dailyCap > 0 ? Math.min(100, (perCallCap / dailyCap) * 100) : 0;
  const remaining = Math.max(0, dailyCap - spent);
  const callsLeft = perCallCap > 0 ? Math.floor(remaining / Math.max(1, perCallCap)) : 0;

  return (
    <aside className="meter" aria-label="Spending policy status">
      <div className="meter__head">
        <span className="meter__label">Today&apos;s budget</span>
        <span className="meter__value mono">
          {usd(spent)} <span className="meter__of">of {usd(dailyCap)}</span>
        </span>
      </div>

      <div className="meter__track" role="img" aria-label={`${percent.toFixed(0)}% of daily budget used`}>
        <span className="meter__fill" style={{ width: `${percent}%` }} />
        <span className="meter__cap" style={{ left: `${capPercent}%` }} title={`per-call cap ${usd(perCallCap)}`} />
      </div>

      <div className="meter__legend">
        <span>
          <i className="dot dot--spent" /> spent today
        </span>
        <span>
          <i className="dot dot--cap" /> per-call cap {usd(perCallCap)}
        </span>
      </div>

      <dl className="meter__stats">
        <div>
          <dt>Agent holds</dt>
          <dd className="mono">{usd(agentTokens)}</dd>
        </div>
        <div>
          <dt>This run</dt>
          <dd className="mono">{usd(runSpend)}</dd>
        </div>
        <div>
          <dt>Calls left at cap</dt>
          <dd className="mono">{callsLeft}</dd>
        </div>
      </dl>

      <p className="meter__note">
        Every limit is checked between the 402 and the signature. A refusal is a transaction that
        was never built.
      </p>
    </aside>
  );
}
