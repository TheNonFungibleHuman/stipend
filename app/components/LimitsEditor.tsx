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
  { label: '$0.05', perCallCap: 50_000 },
  { label: '$0.10', perCallCap: 100_000 },
  { label: '$1.00', perCallCap: 1_000_000 },
];

export function LimitsEditor({ policy, onApply, disabled }: Props) {
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
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Limits</h2>
        <span className="card__note">checked before signing</span>
      </div>

      <div className="limits">
        <div className="knob">
          <div className="knob__row">
            <label className="knob__label" htmlFor="per-call">
              Per-call cap
            </label>
            <output className="knob__value">{usd(perCall)}</output>
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
          <div className="knob__scale">
            <span>$0.01</span>
            <span>$1.00</span>
          </div>
        </div>

        <div className="knob">
          <div className="knob__row">
            <label className="knob__label" htmlFor="daily">
              Daily budget
            </label>
            <output className="knob__value">{usd(daily)}</output>
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
          <div className="knob__scale">
            <span>$0.10</span>
            <span>$5.00</span>
          </div>
        </div>

        <div className="limits__actions">
          <button
            className="switch switch--armed"
            disabled={!dirty || disabled || saving}
            onClick={() => void commit({ perCallCap: perCall, dailyCap: daily })}
          >
            {saving ? 'Saving' : 'Apply'}
          </button>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              className={`switch${preset.perCallCap === perCall ? ' switch--armed' : ''}`}
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
      </div>
    </section>
  );
}
