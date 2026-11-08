'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BudgetMeter } from './BudgetMeter';
import { Economics } from './Economics';
import { FundingGate } from './FundingGate';
import { PolicyCard } from './PolicyCard';
import { ReceiptTape } from './ReceiptTape';
import { RunLedger } from './RunLedger';
import type { Run, StateResponse } from '../types';
import { shortAddress } from '../types';

const DEFAULT_GOAL =
  'Should we launch usage-based pricing for our AI observability product, and at what price?';

export default function Dashboard() {
  const [data, setData] = useState<StateResponse | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [busy, setBusy] = useState<null | 'normal' | 'rogue'>(null);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef<Run | null>(null);

  runRef.current = run;

  const loadState = useCallback(async (refresh = false) => {
    try {
      const response = await fetch(`/api/state${refresh ? '?refresh=1' : ''}`, {
        cache: 'no-store',
      });
      const json = (await response.json()) as StateResponse;
      setData(json);
      if (json.error) setError(json.error);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'could not reach the server');
    }
  }, []);

  useEffect(() => {
    void loadState();
    const timer = setInterval(() => void loadState(), 6000);
    return () => clearInterval(timer);
  }, [loadState]);

  // Poll the active run fast enough that settlements look live, then stop.
  useEffect(() => {
    if (!run || run.status !== 'running') return;
    const id = run.id;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/run/${id}`, { cache: 'no-store' });
        if (!response.ok) return;
        const json = (await response.json()) as { run: Run };
        setRun(json.run);
        if (json.run.status !== 'running') void loadState(true);
      } catch {
        /* a dropped poll is not worth surfacing */
      }
    }, 450);
    return () => clearInterval(timer);
  }, [run?.id, run?.status, loadState]);

  const startRun = async (mode: 'normal' | 'rogue') => {
    setBusy(mode);
    setError(null);
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, mode }),
      });
      const json = (await response.json()) as { run?: Run; error?: string };
      if (json.error || !json.run) throw new Error(json.error ?? 'run did not start');
      setRun(json.run);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'run did not start');
    } finally {
      setBusy(null);
    }
  };

  const applyPolicy = async (patch: { perCallCap?: number; dailyCap?: number }) => {
    try {
      await fetch('/api/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await loadState(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'policy update failed');
    }
  };

  if (!data) {
    return (
      <main className="shell">
        <div className="boot">
          <span className="boot__pulse" />
          Connecting to devnet…
        </div>
      </main>
    );
  }

  if (data.needsFunding) {
    return (
      <FundingGate
        address={data.treasuryAddress ?? ''}
        faucetUrl={data.faucetUrl ?? 'https://faucet.solana.com'}
        message={data.message}
        onCheck={() => void loadState(true)}
      />
    );
  }

  const snapshot = data.snapshot;
  const policy = data.policy ?? snapshot?.policy;
  const ledger = data.ledger ?? [];
  const running = run?.status === 'running';

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__word">Stipend</span>
          <span className="brand__tag">agent budgets on Solana</span>
        </div>
        <div className="topbar__meta">
          <span className="pill pill--live">
            <span className="pill__dot" /> devnet
          </span>
          <span className="pill mono" title={snapshot?.agent.address}>
            agent {shortAddress(snapshot?.agent.address ?? '')}
          </span>
          <span className="pill mono" title="engine behind the paid services">
            {data.llm?.configured ? data.llm.label : 'deterministic engine'}
          </span>
        </div>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <h1 className="hero__title">
            Give your agent a budget,
            <br />
            not your keys.
          </h1>
          <p className="hero__sub">
            Stipend gives an AI agent its own stablecoin wallet and a spending policy that is
            checked <em>before</em> every signature. It buys what it needs, one call at a time, and
            the receipts settle on Solana in about half a second.
          </p>
          <div className="hero__actions">
            <button
              className="btn btn--primary"
              onClick={() => void startRun('normal')}
              disabled={running || busy !== null}
            >
              {busy === 'normal' || running ? 'Running…' : 'Run a research task'}
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => void startRun('rogue')}
              disabled={running || busy !== null}
            >
              Send it to an overpriced vendor
            </button>
          </div>
          {error && <p className="hero__error">{error}</p>}
        </div>

        <BudgetMeter
          spentToday={data.spentToday ?? 0}
          policy={policy}
          agentTokens={snapshot?.agent.tokensRaw ?? 0}
          runSpend={run?.spend ?? 0}
        />
      </section>

      <div className="grid">
        <section className="panel panel--run">
          <div className="panel__head">
            <h2 className="panel__title">The run</h2>
            <span className="panel__note">
              {run
                ? run.status === 'running'
                  ? 'live'
                  : `${run.steps.filter((step) => step.status === 'settled').length} paid · ${run.refused} refused`
                : 'idle'}
            </span>
          </div>

          <label className="field">
            <span className="field__label">Goal the agent is buying data for</span>
            <textarea
              className="field__input"
              value={goal}
              rows={2}
              onChange={(event) => setGoal(event.target.value)}
              spellCheck={false}
            />
          </label>

          <div className="chipset">
            {data.services?.map((service) => (
              <span className="chip" key={service.id}>
                <span className="chip__name">{service.name}</span>
                <span className="chip__price mono">${(service.price / 1_000_000).toFixed(2)}</span>
              </span>
            ))}
            <span className="chip chip--hostile">
              <span className="chip__name">{data.hostileService?.name}</span>
              <span className="chip__price mono">
                ${((data.hostileService?.price ?? 0) / 1_000_000).toFixed(2)}
              </span>
            </span>
          </div>

          <RunLedger run={run} />

          {run?.verdict && (
            <article className="verdict">
              <h3 className="verdict__title">What the agent delivered</h3>
              <p className="verdict__body">{run.verdict}</p>
            </article>
          )}
        </section>

        <aside className="side">
          <PolicyCard policy={policy} onApply={applyPolicy} disabled={running} />
          <ReceiptTape ledger={ledger} />
        </aside>
      </div>

      <Economics ledger={ledger} agentTokens={snapshot?.agent.tokensRaw ?? 0} mint={snapshot?.mint} />

      <footer className="foot">
        <span>
          Real devnet transactions · mint{' '}
          <a href={`https://explorer.solana.com/address/${snapshot?.mint}?cluster=devnet`} target="_blank" rel="noreferrer">
            {shortAddress(snapshot?.mint ?? '', 6)}
          </a>{' '}
          · {snapshot?.rpcHost}
        </span>
        <span>
          Treasury holds {snapshot?.treasury.sol.toFixed(3)} SOL for fees · market data is a
          synthetic demo set
        </span>
      </footer>
    </main>
  );
}
