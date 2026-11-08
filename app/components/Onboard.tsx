'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AmountInput } from './AmountInput';
import type { PublicAgent } from '../types';
import { shortAddress, usd } from '../types';

const CATALOG = [
  { id: 'market-intel', name: 'Market Intel', price: 40_000 },
  { id: 'summarize', name: 'Summarizer', price: 60_000 },
  { id: 'brief-writer', name: 'Brief Writer', price: 80_000 },
];

const STEPS = ['Identity', 'Policy', 'Wallet'] as const;

export function Onboard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('Atlas');
  const [perCall, setPerCall] = useState(1_000_000);
  const [daily, setDaily] = useState(5_000_000);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funded, setFunded] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          perCallCap: perCall,
          dailyCap: daily,
          allowlist,
        }),
      });
      const json = (await response.json()) as { agent?: PublicAgent; error?: string };
      if (json.error || !json.agent) throw new Error(json.error ?? 'could not create the agent');
      setAgent(json.agent);
      setStep(3);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'could not create the agent');
    } finally {
      setBusy(false);
    }
  };

  const fund = async () => {
    if (!agent) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/agents/${agent.id}/fund`, { method: 'POST' });
      const json = (await response.json()) as { tokensRaw?: number; error?: string };
      if (json.error || json.tokensRaw === undefined) {
        throw new Error(json.error ?? 'devnet rejected the top-up');
      }
      setFunded(json.tokensRaw);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `${cause.message} — the treasury needs devnet SOL before it can move anything.`
          : 'devnet rejected the top-up',
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="onboard">
      <ol className="rail" aria-label="Setup steps">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const state = step === number ? 'current' : step > number ? 'done' : 'todo';
          return (
            <li key={label} className={`rail__item rail__item--${state}`}>
              <span className="rail__n">{String(number).padStart(2, '0')}</span>
              <span className="rail__label">{label}</span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <section className="card onboard__card">
          <div className="card__head">
            <h1 className="card__title">Step one — name the agent</h1>
            <span className="card__note">1 of 3</span>
          </div>
          <p className="onboard__lede">
            This is what appears on the console and on every receipt. Nothing is created until you
            press continue.
          </p>
          <label className="field">
            <span className="field__label">Agent name</span>
            <input
              className="field__input field__input--line"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              placeholder="Atlas"
            />
          </label>
          <div className="controls">
            <button
              className="key key--go"
              onClick={() => setStep(2)}
              disabled={name.trim().length === 0}
            >
              Continue to policy
            </button>
            <Link className="key key--stop" href="/app">
              Cancel
            </Link>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card onboard__card">
          <div className="card__head">
            <h1 className="card__title">Step two — set the caps</h1>
            <span className="card__note">2 of 3</span>
          </div>
          <p className="onboard__lede">
            These are the only limits that will stop a purchase. They are checked between the price
            quote and the signature, so a refused purchase is a transaction that never existed.
          </p>

          <AmountInput
            id="onboard-per-call"
            label="Per-call cap"
            value={perCall}
            onChange={setPerCall}
            hint="One purchase may not exceed this."
          />

          <AmountInput
            id="onboard-daily"
            label="Daily budget"
            value={daily}
            onChange={setDaily}
            quick={[1_000_000, 5_000_000, 20_000_000, 100_000_000]}
            hint="Rolling 24 hours of spending."
          />

          <fieldset className="allowlist">
            <legend className="field__label">
              Payee allowlist — leave empty to allow any listed vendor
            </legend>
            <div className="allowlist__row">
              {CATALOG.map((service) => {
                const on = allowlist.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    className={`switch${on ? ' switch--armed' : ''}`}
                    aria-pressed={on}
                    onClick={() =>
                      setAllowlist((current) =>
                        on ? current.filter((id) => id !== service.id) : [...current, service.id],
                      )
                    }
                  >
                    {service.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="controls">
            <button className="key key--go" onClick={() => void create()} disabled={busy}>
              {busy ? 'Creating…' : 'Create the agent'}
            </button>
            <button className="key key--stop" onClick={() => setStep(1)} disabled={busy}>
              Back
            </button>
          </div>
          {error && <p className="hero__error">{error}</p>}
        </section>
      )}

      {step === 3 && agent && (
        <section className="card onboard__card">
          <div className="card__head">
            <h1 className="card__title">Step three — it exists</h1>
            <span className="card__note">3 of 3</span>
          </div>
          <p className="onboard__lede">
            <strong>{agent.name}</strong> has its own keypair and token account. Fund it, then hand
            it the token — it can start buying immediately.
          </p>

          <div className="issued">
            <div className="issued__row">
              <span className="issued__k">Wallet</span>
              <code className="issued__v">{agent.address}</code>
              <button className="switch" onClick={() => void copy(agent.address, 'address')}>
                {copied === 'address' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="issued__row">
              <span className="issued__k">API token</span>
              <code className="issued__v">{agent.token}</code>
              <button className="switch" onClick={() => void copy(agent.token, 'token')}>
                {copied === 'token' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="issued__row">
              <span className="issued__k">Caps</span>
              <span className="issued__v">
                {usd(agent.policy.perCallCap)} a call · {usd(agent.policy.dailyCap)} a day
                {agent.policy.allowlist.length > 0
                  ? ` · ${agent.policy.allowlist.length} allowed vendors`
                  : ' · any vendor'}
              </span>
            </div>
          </div>

          <div className="issued__actions">
            <button className="switch switch--armed" onClick={() => void fund()} disabled={busy}>
              {funded !== null ? `Funded — ${usd(funded)}` : busy ? 'Funding…' : 'Fund 25 dUSD'}
            </button>
            <button
              className="key key--go"
              onClick={() => router.push(`/app?agent=${agent.id}`)}
            >
              Open the console →
            </button>
          </div>

          <pre className="wire__body">{`# the agent asks a vendor for data
curl -X POST http://127.0.0.1:4310/api/paid/market-intel \\
  -H "x-agent-token: ${agent.token}" \\
  -H "content-type: application/json" \\
  -d '{"query":"ai observability pricing"}'`}</pre>

          {error && <p className="hero__error">{error}</p>}
          <p className="onboard__foot">
            Wallet {shortAddress(agent.address, 6)} is a devnet keypair held by this server for the
            demo. In production the agent would hold its own key and present only the token.
          </p>
        </section>
      )}
    </div>
  );
}
