'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentPanel } from './AgentPanel';
import { FundingGate } from './FundingGate';
import { LedgerTable } from './LedgerTable';
import { LimitsEditor } from './LimitsEditor';
import { MeterHead } from './MeterHead';
import { RunsTable } from './RunsTable';
import { RunSteps } from './RunSteps';
import { StatusStrip } from './StatusStrip';
import type { Run, StateResponse } from '../types';
import { shortAddress } from '../types';

const DEFAULT_GOAL =
  'Should we launch usage-based pricing for our AI observability product, and at what price?';

export default function Console({
  initialAgentId,
  initialToken,
  initialView,
  mcpPath,
}: {
  initialAgentId?: string;
  initialToken?: string;
  initialView?: string;
  mcpPath: string;
}) {
  const [readOnly, setReadOnly] = useState(Boolean(initialView));
  const keyed = Boolean(initialToken || initialView);
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

  /** A keyed console link proves ownership on every mutation. */
  const authHeaders = (extra: Record<string, string> = {}): Record<string, string> =>
    initialToken ? { ...extra, 'x-agent-token': initialToken } : extra;

  const loadState = useCallback(async (refresh = false) => {
    try {
      const query = new URLSearchParams();
      if (refresh) query.set('refresh', '1');
      if (initialView) query.set('view', initialView);
      else if (initialToken) query.set('token', initialToken);
      else if (activeId.current) query.set('agent', activeId.current);
      const response = await fetch(`/api/state?${query.toString()}`, { cache: 'no-store' });
      const json = (await response.json()) as StateResponse;
      failures.current = 0;
      setConnError(null);
      setData(json);
      if (typeof json.readOnly === 'boolean') setReadOnly(json.readOnly);
      if (json.activeAgentId && json.activeAgentId !== activeId.current) {
        activeId.current = json.activeAgentId;
        setAgentId(json.activeAgentId);
      }
      if (json.error) setActionError(json.error);
    } catch {
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
        headers: authHeaders({ 'Content-Type': 'application/json' }),
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
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(patch),
      });
      await loadState(true);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'policy update failed');
    }
  };

  const fundAgent = async () => {
    if (!agentId) return;
    setActionError(null);
    try {
      const response = await fetch(`/api/agents/${agentId}/fund`, { method: 'POST', headers: authHeaders() });
      const json = (await response.json()) as { error?: string };
      if (json.error) throw new Error(json.error);
      await loadState(true);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'top-up failed');
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
  const agents = data.agents ?? [];
  const active =
    agents.find((agent) => agent.id === (agentId ?? data.activeAgentId)) ??
    agents.find((agent) => agent.id === snapshot?.agent.id);
  const running = run?.status === 'running';
  const refusedCount = ledger.filter((entry) => entry.decision === 'refused').length;
  const baseUrl = typeof window === 'undefined' ? 'http://127.0.0.1:4310' : window.location.origin;

  return (
    <main className="cabinet">
      <header className="plate">
        <Link className="plate__brand" href="/">
          <span className="plate__serial">S-402</span>
          <span className="plate__name">Stipend</span>
        </Link>
        <div className="plate__right">
          <span className="lamp lamp--live">devnet</span>
          {readOnly && <span className="lamp lamp--warn">shared view</span>}
          {data.fixture && <span className="lamp lamp--warn">recorded session</span>}
          {!readOnly && agents.length > 0 && (
            <label className="selector">
              <span className="selector__label">Agent</span>
              <select
                className="selector__input"
                value={active?.id ?? ''}
                onChange={(event) => switchAgent(event.target.value)}
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                    {agent.demo && !/demo/i.test(agent.name) ? ' (demo)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Link className="plate__meta plate__link" href={readOnly ? '/' : '/start'}>
            {readOnly ? 'what is this? →' : '+ new agent'}
          </Link>
        </div>
      </header>

      <StatusStrip
        spentToday={data.spentToday ?? 0}
        policy={policy}
        agentTokens={snapshot?.agent.tokensRaw ?? 0}
        ledger={ledger}
      />

      {(actionError || connError) && (
        <p className="hero__error">{actionError ?? connError}</p>
      )}

      <div className="deck deck--dash">
        <div className="dash-main">
          <section className="card">
            <div className="card__head">
              <h2 className="card__title">Job</h2>
              <span className="card__note">
                {run ? `${run.mode} · ${run.status}` : 'no active run'}
              </span>
            </div>

            <label className="field">
              <span className="field__label">Goal</span>
              <textarea
                className="field__input"
                value={goal}
                rows={2}
                onChange={(event) => setGoal(event.target.value)}
                spellCheck={false}
              />
            </label>

            <div className="controls">
              <button
                className="key key--go"
                onClick={() => void startRun('normal')}
                disabled={running || busy !== null || readOnly}
                title={readOnly ? 'read-only shared view' : undefined}
              >
                {busy === 'normal' || running ? 'Running…' : 'Run pipeline'}
              </button>
              <button
                className="key key--stop"
                onClick={() => void startRun('rogue')}
                disabled={running || busy !== null || readOnly}
                title={readOnly ? 'read-only shared view' : undefined}
              >
                Test refusal
              </button>
            </div>

            <RunSteps run={run} />
          </section>

          <RunsTable runs={data.runSummaries ?? []} />
          {active && (
            <AgentPanel
              agent={active}
              snapshot={snapshot}
              baseUrl={baseUrl}
              mcpPath={mcpPath}
              readOnly={readOnly}
              onFund={() => void fundAgent()}
              funding={busy !== null}
            />
          )}
        </div>

        <aside className="side">
          <MeterHead
            spentToday={data.spentToday ?? 0}
            policy={policy}
            agentTokens={snapshot?.agent.tokensRaw ?? 0}
            runSpend={run?.spend ?? 0}
            refusedCount={refusedCount}
            agentName={snapshot?.agent.name}
          />
          <LimitsEditor policy={policy} onApply={applyPolicy} disabled={running || readOnly} />
        </aside>
      </div>

      <LedgerTable ledger={ledger} />

      <footer className="foot">
        <span>
          mint{' '}
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
          treasury {snapshot?.treasury.sol.toFixed(3)} SOL · {agents.length} agents · engine{' '}
          {data.llm?.configured ? data.llm.label : 'deterministic'}
        </span>
      </footer>
    </main>
  );
}
