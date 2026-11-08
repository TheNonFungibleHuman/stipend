'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentPanel } from './AgentPanel';
import { StartPanel } from './StartPanel';
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
}: {
  initialAgentId?: string;
  initialToken?: string;
  initialView?: string;
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
  const [bootStage, setBootStage] = useState<'connecting' | 'slow' | 'failed'>('connecting');
  const failures = useRef(0);
  const inFlight = useRef(false);
  const activeId = useRef<string | undefined>(initialAgentId);
  activeId.current = agentId;

  /** A keyed console link proves ownership on every mutation. */
  const authHeaders = (extra: Record<string, string> = {}): Record<string, string> =>
    initialToken ? { ...extra, 'x-agent-token': initialToken } : extra;

  /**
   * A request that never answers used to leave the console on "Connecting to
   * devnet" forever, because only a rejection counted as a failure. The timeout
   * turns a hang into an error, the in-flight guard stops the 6s poll from
   * stacking requests on a cold serverless function, and the boot screen below
   * now says what happened instead of spinning.
   */
  const loadState = useCallback(async (refresh = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const query = new URLSearchParams();
      if (refresh) query.set('refresh', '1');
      if (initialView) query.set('view', initialView);
      else if (initialToken) query.set('token', initialToken);
      else if (activeId.current) query.set('agent', activeId.current);
      const response = await fetch(`/api/state?${query.toString()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`the server answered ${response.status}`);
      const json = (await response.json()) as StateResponse;
      failures.current = 0;
      setConnError(null);
      setBootStage('connecting');
      setData(json);
      if (typeof json.readOnly === 'boolean') setReadOnly(json.readOnly);
      if (json.activeAgentId && json.activeAgentId !== activeId.current) {
        activeId.current = json.activeAgentId;
        setAgentId(json.activeAgentId);
      }
      if (json.error) setActionError(json.error);
    } catch (error) {
      failures.current += 1;
      const reason = error instanceof Error ? error.message : 'unknown error';
      if (failures.current >= 2) {
        setBootStage('failed');
        setConnError(reason);
      } else {
        setBootStage('slow');
      }
    } finally {
      inFlight.current = false;
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

  /**
   * The run streams back as newline-delimited JSON, so each step renders the
   * moment it changes. That is the difference between "something is happening"
   * and a spinner that sits there for twelve seconds.
   */
  const startRun = async (mode: 'normal' | 'rogue') => {
    setBusy(mode);
    setActionError(null);
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ goal, mode, agentId }),
      });

      if (!response.ok || !response.body) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `run rejected (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let index: number;
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (!line) continue;

          const event = JSON.parse(line) as
            | { type: 'run'; run: Run }
            | { type: 'done'; run: Run }
            | { type: 'error'; message: string };

          if (event.type === 'error') throw new Error(event.message);
          if (event.type === 'run' || event.type === 'done') setRun(event.run);
        }
      }

      await loadState(true);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'run did not start');
    } finally {
      setBusy(null);
    }
  };

  const applyAllowlist = async (allowlist: string[]) => {
    if (!agentId) return;
    try {
      await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ allowlist }),
      });
      await loadState(true);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'could not save the payee list');
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
          {bootStage === 'failed' ? (
            <div className="boot__failed">
              <p className="boot__title">Could not reach Solana</p>
              <p className="boot__reason">{connError}</p>
              <button className="switch switch--armed" onClick={() => void loadState(true)}>
                Try again
              </button>
            </div>
          ) : (
            <>
              <span className="boot__pulse" aria-hidden="true" />
              {bootStage === 'slow' ? 'devnet is slow — still connecting' : 'Connecting to devnet'}
            </>
          )}
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
  // The pipeline belongs to the demo agent. A personal agent is driven from its
  // owner's own agent, so this page shows setup instead of a run button.
  const isDemo = active?.demo === true;
  const refusedCount = ledger.filter((entry) => entry.decision === 'refused').length;
  const baseUrl =
    typeof window === 'undefined'
      ? process.env.NEXT_PUBLIC_APP_URL ?? 'https://stipend-delta.vercel.app'
      : window.location.origin;

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
          {!isDemo && active && (
            <StartPanel
              agent={active}
              baseUrl={baseUrl}
              balanceRaw={snapshot?.agent.tokensRaw ?? 0}
              onFund={() => void fundAgent()}
              funding={busy !== null}
            />
          )}

          {isDemo && (
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
          )}

          {isDemo && <RunsTable runs={data.runSummaries ?? []} />}
          {isDemo && active && (
            <AgentPanel
              agent={active}
              snapshot={snapshot}
              baseUrl={baseUrl}
              readOnly={readOnly}
              onFund={() => void fundAgent()}
              onAllowlist={(list) => void applyAllowlist(list)}
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
