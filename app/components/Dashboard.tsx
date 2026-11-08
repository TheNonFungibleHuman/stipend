'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Economics } from './Economics';
import { FundingGate } from './FundingGate';
import { HowItWorks } from './HowItWorks';
import { MeterHead } from './MeterHead';
import { PolicyCard } from './PolicyCard';
import { ReceiptTape } from './ReceiptTape';
import { RunLedger } from './RunLedger';
import type { Run, StateResponse } from '../types';
import { shortAddress } from '../types';

const DEFAULT_GOAL =
  'Should we launch usage-based pricing for our AI observability product, and at what price?';

export default function Dashboard({ initialAgentId }: { initialAgentId?: string }) {
  const [data, setData] = useState<StateResponse | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [agentId, setAgentId] = useState<string | undefined>(initialAgentId);
  const [busy, setBusy] = useState<null | 'normal' | 'rogue'>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const failures = useRef(0);
  const activeId = useRef<string | undefined>(initialAgentId);
  activeId.current = agentId;

  const loadState = useCallback(async (refresh = false) => {
    try {
      const query = new URLSearchParams();
      if (refresh) query.set('refresh', '1');
      if (activeId.current) query.set('agent', activeId.current);
      const response = await fetch(`/api/state?${query.toString()}`, { cache: 'no-store' });
      const json = (await response.json()) as StateResponse;
      failures.current = 0;
      setConnError(null);
      setData(json);
      if (json.activeAgentId && json.activeAgentId !== activeId.current) {
        // The server resolved a different agent than we asked for.
        activeId.current = json.activeAgentId;
        setAgentId(json.activeAgentId);
      }
      if (json.error) setActionError(json.error);
    } catch {
      // One dropped poll is normal; only speak up when it repeats.
      failures.current += 1;
      if (failures.current >= 3) {
        setConnError('lost the connection to the local server — is it still running?');
      }
    }
  }, []);

  useEffect(() => {
    void loadState();
    const timer = setInterval(() => void loadState(), 6000);
    return () => clearInterval(timer);
  }, [loadState]);

  // Poll the active run fast enough that settlements read as live, then stop.
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
    setActionError(null);
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, mode, agentId }),
      });
      const json = (await response.json()) as { run?: Run; error?: string };
      if (json.error || !json.run) throw new Error(json.error ?? 'run did not start');
      setRun(json.run);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'run did not start');
    } finally {
      setBusy(null);
    }
  };

  const applyPolicy = async (patch: { perCallCap?: number; dailyCap?: number }) => {
    if (!agentId) return;
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await loadState(true);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'policy update failed');
    }
  };

  const switchAgent = (id: string) => {
    setAgentId(id);
    activeId.current = id;
    setRun(null);
    void loadState(true);
  };

  if (!data) {
    return (
      <main className="cabinet">
        <div className="boot">
          <span className="boot__pulse" aria-hidden="true" />
          Connecting to devnet
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
  const refusedCount = ledger.filter((entry) => entry.decision === 'refused').length;
  const runPrice = (data.services ?? []).reduce((sum, service) => sum + service.price, 0);

  return (
    <main className="cabinet">
      <header className="plate">
        <Link className="plate__brand" href="/">
          <span className="plate__serial">S-402</span>
          <span className="plate__name">Stipend</span>
        </Link>
        <div className="plate__right">
          <span className="lamp lamp--live">devnet</span>
          {data.fixture && <span className="lamp lamp--warn">recorded session</span>}
          {data.agents && data.agents.length > 1 ? (
            <label className="selector">
              <span className="selector__label">Agent</span>
              <select
                className="selector__input"
                value={agentId ?? data.activeAgentId ?? ''}
                onChange={(event) => switchAgent(event.target.value)}
              >
                {data.agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="plate__meta" title={snapshot?.agent.address}>
              {snapshot?.agent.name} · {shortAddress(snapshot?.agent.address ?? '')}
            </span>
          )}
          <Link className="plate__meta plate__link" href="/start">
            + new agent
          </Link>
        </div>
      </header>

      <section className="bay">
        <div>
          <p className="kicker">Agent payments · settled on Solana devnet</p>
          <h1 className="thesis">
            Your agent gets a <em>budget</em>.
            <br />
            Not your keys.
          </h1>
          <p className="gloss">
            Stipend gives an AI agent its own wallet and a spending policy that is checked{' '}
            <strong>before every signature</strong>. It buys the data it needs one call at a time,
            and each purchase settles on Solana in about half a second.
          </p>

          <div className="controls">
            <button
              className="key key--go"
              onClick={() => void startRun('normal')}
              disabled={running || busy !== null}
            >
              {busy === 'normal' || running ? 'Running…' : 'Run a research task'}
              <span className="key__price">${(runPrice / 1_000_000).toFixed(2)}</span>
            </button>
            <button
              className="key key--stop"
              onClick={() => void startRun('rogue')}
              disabled={running || busy !== null}
            >
              Send it to a $5.00 vendor
              <span className="key__price">refused</span>
            </button>
          </div>
          {(actionError || connError) && (
            <p className="hero__error">{actionError ?? connError}</p>
          )}

          <ul className="legend">
            {data.services?.map((service) => (
              <li className="legend__item" key={service.id}>
                {service.name}
                <span className="legend__price">${(service.price / 1_000_000).toFixed(2)}</span>
              </li>
            ))}
            <li className="legend__item legend__item--hostile">
              {data.hostileService?.name}
              <span className="legend__price">
                ${((data.hostileService?.price ?? 0) / 1_000_000).toFixed(2)}
              </span>
            </li>
          </ul>
        </div>

        <MeterHead
          spentToday={data.spentToday ?? 0}
          policy={policy}
          agentTokens={snapshot?.agent.tokensRaw ?? 0}
          runSpend={run?.spend ?? 0}
          refusedCount={refusedCount}
          agentName={snapshot?.agent.name}
        />
      </section>

      <HowItWorks />

      <div className="deck">
        <section className="card">
          <div className="card__head">
            <h2 className="card__title">The run</h2>
            <span className="card__note">
              {run
                ? run.status === 'running'
                  ? 'live'
                  : `${run.steps.filter((step) => step.status === 'settled').length} paid · ${run.refused} refused`
                : 'idle'}
            </span>
          </div>

          <label className="field">
            <span className="field__label">What the agent is buying data for</span>
            <textarea
              className="field__input"
              value={goal}
              rows={2}
              onChange={(event) => setGoal(event.target.value)}
              spellCheck={false}
            />
          </label>

          <RunLedger run={run} services={data.services} hostilePrice={data.hostileService?.price} />

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
          real devnet transactions · mint{' '}
          <a
            href={`https://explorer.solana.com/address/${snapshot?.mint}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
          >
            {shortAddress(snapshot?.mint ?? '', 6)}
          </a>{' '}
          · {snapshot?.rpcHost}
        </span>
        <span>
          treasury {snapshot?.treasury.sol.toFixed(3)} SOL for fees · market data is a synthetic demo
          set
        </span>
      </footer>
    </main>
  );
}
