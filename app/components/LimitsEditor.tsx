'use client';

import { useEffect, useState } from 'react';
import { AmountInput } from './AmountInput';
import type { Policy } from '../types';
import { usd } from '../types';

interface Props {
  policy?: Policy;
  onApply: (patch: { perCallCap?: number; dailyCap?: number }) => Promise<void>;
  disabled: boolean;
}

export function LimitsEditor({ policy, onApply, disabled }: Props) {
  const [perCall, setPerCall] = useState(policy?.perCallCap ?? 1_000_000);
  const [daily, setDaily] = useState(policy?.dailyCap ?? 5_000_000);
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
        <AmountInput
          id="per-call"
          label="Per-call cap"
          value={perCall}
          onChange={setPerCall}
          disabled={disabled || saving}
          hint="A single purchase above this is refused before signing."
        />

        <AmountInput
          id="daily"
          label="Daily budget"
          value={daily}
          onChange={setDaily}
          quick={[1_000_000, 5_000_000, 20_000_000, 100_000_000]}
          disabled={disabled || saving}
          hint="Rolling 24 hours. When it is used up, the agent stops being able to buy."
        />

        <div className="limits__actions">
          <button
            className="switch switch--armed"
            disabled={!dirty || disabled || saving}
            onClick={() => void commit({ perCallCap: perCall, dailyCap: daily })}
          >
            {saving ? 'Saving' : 'Apply limits'}
          </button>
          <span className="limits__summary mono">
            {usd(perCall)} a call · {usd(daily)} a day
          </span>
        </div>
      </div>
    </section>
  );
}
