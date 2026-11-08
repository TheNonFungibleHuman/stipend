'use client';

import { useEffect, useState } from 'react';
import { usd } from '../types';

interface Props {
  id: string;
  label: string;
  /** Value in base units (6 decimals). */
  value: number;
  onChange: (value: number) => void;
  quick?: number[];
  hint?: string;
  disabled?: boolean;
  /** Base-unit ceiling; the field refuses to go above it. */
  max?: number;
}

/**
 * A limit an operator types, not a slider we bounded. The old sliders topped out
 * at $1.00 a call and $5.00 a day, which quietly made a product decision that is
 * not ours to make.
 */
export function AmountInput({
  id,
  label,
  value,
  onChange,
  quick = [50_000, 100_000, 500_000, 1_000_000],
  hint,
  disabled,
  max = 1_000_000_000_000,
}: Props) {
  const [draft, setDraft] = useState((value / 1_000_000).toFixed(2));
  const [bad, setBad] = useState(false);

  useEffect(() => {
    setDraft((value / 1_000_000).toFixed(2));
    setBad(false);
  }, [value]);

  const commit = (raw: string) => {
    const dollars = Number(raw);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setBad(true);
      return;
    }
    const base = Math.round(dollars * 1_000_000);
    if (base > max) {
      setBad(true);
      return;
    }
    setBad(false);
    onChange(base);
  };

  return (
    <div className="amount">
      <div className="amount__row">
        <label className="amount__label" htmlFor={id}>
          {label}
        </label>
        <output className="amount__value">{usd(value)}</output>
      </div>

      <div className="amount__field">
        <span className="amount__currency mono">$</span>
        <input
          id={id}
          className={`amount__input${bad ? ' is-bad' : ''}`}
          type="number"
          min="0.001"
          step="0.01"
          inputMode="decimal"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit((event.target as HTMLInputElement).value);
          }}
        />
        <span className="amount__suffix mono">USD / {label.includes('call') ? 'call' : 'day'}</span>
      </div>

      <div className="amount__quick">
        {quick.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`switch${preset === value ? ' switch--armed' : ''}`}
            disabled={disabled}
            onClick={() => onChange(preset)}
          >
            {usd(preset).replace('.00', '')}
          </button>
        ))}
      </div>

      {bad && <p className="amount__error">Enter an amount in dollars, above zero.</p>}
      {hint && !bad && <p className="amount__hint">{hint}</p>}
    </div>
  );
}
