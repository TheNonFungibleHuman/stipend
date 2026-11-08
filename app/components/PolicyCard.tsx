'use client';

import { useEffect, useState } from 'react';
import type { Policy } from '../types';
import { usd } from '../types';

interface Props {
  policy?: Policy;
  onApply: (patch: { perCallCap?: number; dailyCap?: number }) => Promise<void>;
  disabled: boolean;
}

const PRESETS = [
  { label: '$0.05 cap', perCallCap: 50_000, hint: 'blocks the $0.06 and $0.08 calls' },
  { label: '$0.10 cap', perCallCap: 100_000, hint: 'the default' },
  { label: '$1.00 cap', perCallCap: 1_000_000, hint: 'lets the $5.00 vendor through' },
];

export function PolicyCard({ policy, onApply, disabled }: Props) {
  const [perCall, setPerCall] = useState(policy?.perCallCap ?? 100_000);
  const [daily, setDaily] = useState(policy?.dailyCap ?? 1_000_000);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!policy) return;
    setPerCall(policy.perCallCap);
    setDaily(policy.dailyCap);
  }, [policy?.perCallCap, policy?.dailyCap]);

  const dirty = perCall !== policy?.perCallCap || daily !== policy?.dailyCap;

  const commit = async (next: { perCallCap: number; dailyCap: number }) => {
    setSaving(true);
    try {
      await onApply(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel policy">
      <div className="panel__head">
        <h2 className="panel__title">Spending policy</h2>
        <span className="panel__note">enforced before signing</span>
      </div>

      <div className="slider">
        <div className="slider__row">
          <label className="slider__label" htmlFor="per-call">
            Per-call cap
          </label>
          <output className="slider__value mono">{usd(perCall)}</output>
        </div>
        <input
          id="per-call"
          type="range"
          min={10_000}
          max={1_000_000}
          step={10_000}
          value={perCall}
          disabled={disabled || saving}
          onChange={(event) => setPerCall(Number(event.target.value))}
        />
      </div>

      <div className="slider">
        <div className="slider__row">
          <label className="slider__label" htmlFor="daily">
            Daily budget
          </label>
          <output className="slider__value mono">{usd(daily)}</output>
        </div>
        <input
          id="daily"
          type="range"
          min={100_000}
          max={5_000_000}
          step={100_000}
          value={daily}
          disabled={disabled || saving}
          onChange={(event) => setDaily(Number(event.target.value))}
        />
      </div>

      <div className="policy__actions">
        <button
          className="btn btn--small btn--primary"
          disabled={!dirty || disabled || saving}
          onClick={() => void commit({ perCallCap: perCall, dailyCap: daily })}
        >
          {saving ? 'Saving…' : 'Apply policy'}
        </button>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            className="chip chip--action"
            title={preset.hint}
            disabled={disabled || saving}
            onClick={() => {
              setPerCall(preset.perCallCap);
              void commit({ perCallCap: preset.perCallCap, dailyCap: daily });
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <p className="policy__note">
        Lower the cap, then run a task: the agent still asks, gets a real 402, and stops. The ledger
        shows a refusal, not a failed transaction.
      </p>
    </section>
  );
}
