'use client';

import { useEffect, useRef, useState } from 'react';
import type { Policy } from '../types';
import { usd } from '../types';

interface Props {
  spentToday: number;
  policy?: Policy;
  agentTokens: number;
  runSpend: number;
  refusedCount: number;
  agentName?: string;
}

/**
 * The machine head: a mechanical counter for money still available, a gauge with
 * the per-call cap marked on it, the slot the agent pays through, and the coin
 * return that fills up with the purchases the policy refused.
 */
export function MeterHead({
  spentToday,
  policy,
  agentTokens,
  runSpend,
  refusedCount,
  agentName,
}: Props) {
  const dailyCap = policy?.dailyCap ?? 1_000_000;
  const perCallCap = policy?.perCallCap ?? 100_000;
  const remaining = Math.max(0, dailyCap - spentToday);
  const usedPercent = dailyCap > 0 ? Math.min(100, (spentToday / dailyCap) * 100) : 0;
  const capPercent = dailyCap > 0 ? Math.min(100, (perCallCap / dailyCap) * 100) : 0;
  const callsLeft = perCallCap > 0 ? Math.floor(remaining / perCallCap) : 0;

  const [rolling, setRolling] = useState(false);
  const previous = useRef(remaining);

  useEffect(() => {
    if (previous.current === remaining) return;
    previous.current = remaining;
    setRolling(true);
    const timer = setTimeout(() => setRolling(false), 420);
    return () => clearTimeout(timer);
  }, [remaining]);

  const dollars = Math.floor(remaining / 1_000_000);
  const cents = Math.floor((remaining % 1_000_000) / 10_000);
  const digits = [...String(dollars), '.', ...String(cents).padStart(2, '0')];

  return (
    <aside className="machine" aria-label="Agent budget meter">
      <span className="screw screw--tl" aria-hidden="true" />
      <span className="screw screw--tr" aria-hidden="true" />
      <span className="screw screw--bl" aria-hidden="true" />
      <span className="screw screw--br" aria-hidden="true" />

      <div className="machine__glass">
        <div className="machine__head">
          <span className="machine__label">
            {agentName ? `${agentName} · budget remaining` : 'Budget remaining'}
          </span>
          <span className="machine__reset">resets every 24h</span>
        </div>

        <div
          className={`odometer${rolling ? ' is-rolling' : ''}`}
          role="img"
          aria-label={`${usd(remaining)} of the ${usd(dailyCap)} daily budget left`}
        >
          {digits.map((digit, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={`odometer__cell${
                digit === '.' ? ' odometer__cell--dot' : ''
              }${digit === '0' && index === 0 && dollars === 0 ? ' odometer__cell--dim' : ''}`}
            >
              {digit}
            </span>
          ))}
        </div>

        <p className="machine__gloss">
          {usd(remaining)} left of {usd(dailyCap)} today
        </p>

        <div
          className="gauge"
          role="img"
          aria-label={`${usedPercent.toFixed(0)} percent of the daily budget spent`}
        >
          <span className="gauge__fill" style={{ width: `${usedPercent}%` }} />
          <span className="gauge__cap" style={{ left: `${capPercent}%` }} />
        </div>
        <div className="gauge__readout">
          <span>spent {usd(spentToday)}</span>
          <span>cap {usd(perCallCap)} per call</span>
        </div>

        <div className="slots">
          <div className="slot">
            <span className="slot__mouth" aria-hidden="true" />
            <span className="slot__cap">Pay</span>
            <span className="slot__hint">signs one transfer per call</span>
          </div>
          <div className={`coinreturn${refusedCount > 0 ? ' is-fed' : ''}`}>
            <span className="coinreturn__mouth" aria-hidden="true" />
            <span className="coinreturn__cap">Returned</span>
            <span className="coinreturn__hint">
              {refusedCount > 0 ? `${refusedCount} refused` : 'none refused'}
            </span>
          </div>
        </div>

        <dl className="machine__spec">
          <div>
            <dt>Agent holds</dt>
            <dd>{usd(agentTokens)}</dd>
          </div>
          <div>
            <dt>This run</dt>
            <dd>{usd(runSpend)}</dd>
          </div>
          <div>
            <dt>Calls left</dt>
            <dd>{callsLeft}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
