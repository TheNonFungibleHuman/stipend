import { randomUUID } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { keypairFor, pickAgent, type AgentRecord } from './agents';
import { bootstrap, tokenBalanceOf } from './bootstrap';
import { serviceById, type Policy } from './config';
import { llmLabel } from './llm';
import { paidCall, type Quote } from './pay';
import { cardFeeFor } from './policy';
import { readDocument, writeDocument } from './persist';
import { appendLedger, getLedger, getState, type LedgerEntry } from './store';
import { wallets } from './wallets';

export type StepStatus = 'quoting' | 'denied' | 'settling' | 'settled' | 'error';

export interface RunStep {
  index: number;
  serviceId: string;
  serviceName: string;
  price: number;
  status: StepStatus;
  reason?: string;
  quote?: Quote;
  signature?: string;
  settleMs?: number;
  verifyMs?: number;
  computeMs?: number;
  output?: unknown;
  engine?: 'fetch' | 'model' | 'deterministic';
  source?: 'live' | 'cached';
  note?: string;
  model?: string;
  cardFee?: number;
  startedAt: string;
  endedAt?: string;
}

export interface Run {
  id: string;
  agentId: string;
  agentName: string;
  goal: string;
  mode: 'normal' | 'rogue';
  status: 'running' | 'complete' | 'error';
  startedAt: string;
  endedAt?: string;
  policy: Policy;
  engine: string;
  steps: RunStep[];
  spend: number;
  refused: number;
  verdict?: string;
  error?: string;
}

const globalForRuns = globalThis as unknown as { __stipendRuns?: Map<string, Run> };

function runs(): Map<string, Run> {
  if (!globalForRuns.__stipendRuns) globalForRuns.__stipendRuns = new Map();
  return globalForRuns.__stipendRuns;
}

/**
 * Runs are persisted, not just held in memory.
 *
 * A serverless host has no shared process: the request that starts a run and the
 * request that polls it can land on different instances. Keeping runs in a Map
 * meant the poll never found the run and the console waited forever.
 */
const RUNS_KEY = 'runs';

async function persistRuns(): Promise<void> {
  const all = [...runs().values()].slice(-20);
  await writeDocument(RUNS_KEY, { runs: all });
}

async function loadPersistedRuns(): Promise<Run[]> {
  const stored = await readDocument<{ runs?: Run[] }>(RUNS_KEY, {});
  return Array.isArray(stored.runs) ? stored.runs : [];
}

export interface RunSummary {
  id: string;
  startedAt: string;
  services: string[];
  settled: number;
  refused: number;
  errors: number;
  spend: number;
  status: 'running' | 'complete' | 'error';
}

/**
 * Run history that survives a restart. In-memory runs vanish when the server
 * does, but the ledger is on disk — a dashboard that forgets its own history
 * the moment it restarts is not a dashboard.
 */
export function summariesFromLedger(ledger: LedgerEntry[]): RunSummary[] {
  const grouped = new Map<string, RunSummary>();
  for (const entry of ledger) {
    // Funding events are not runs.
    if (entry.decision === 'funded') continue;
    const existing = grouped.get(entry.runId);
    if (existing) {
      existing.settled += entry.decision === 'settled' ? 1 : 0;
      existing.refused += entry.decision === 'refused' ? 1 : 0;
      existing.errors += entry.decision === 'error' ? 1 : 0;
      existing.spend += entry.decision === 'settled' ? entry.price : 0;
      if (!existing.services.includes(entry.serviceName)) existing.services.unshift(entry.serviceName);
      if (Date.parse(entry.at) < Date.parse(existing.startedAt)) existing.startedAt = entry.at;
    } else {
      grouped.set(entry.runId, {
        id: entry.runId,
        startedAt: entry.at,
        services: [entry.serviceName],
        settled: entry.decision === 'settled' ? 1 : 0,
        refused: entry.decision === 'refused' ? 1 : 0,
        errors: entry.decision === 'error' ? 1 : 0,
        spend: entry.decision === 'settled' ? entry.price : 0,
        status: entry.decision === 'error' ? 'error' : 'complete',
      });
    }
  }
  return [...grouped.values()].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

/** Ledger history with live runs layered on top, so a running job appears once. */
export function mergeSummaries(summaries: RunSummary[], live: Run[]): RunSummary[] {
  const merged = new Map(summaries.map((summary) => [summary.id, summary]));
  for (const run of live) {
    merged.set(run.id, {
      id: run.id,
      startedAt: run.startedAt,
      services: run.steps.map((step) => step.serviceName),
      settled: run.steps.filter((step) => step.status === 'settled').length,
      refused: run.steps.filter((step) => step.status === 'denied').length,
      errors: run.steps.filter((step) => step.status === 'error').length,
      spend: run.spend,
      status: run.status,
    });
  }
  return [...merged.values()].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export async function getRun(id: string): Promise<Run | undefined> {
  const inMemory = runs().get(id);
  if (inMemory) return inMemory;
  const persisted = await loadPersistedRuns();
  const found = persisted.find((run) => run.id === id);
  if (found) runs().set(found.id, found);
  return found;
}

export async function listRuns(agentId?: string): Promise<Run[]> {
  const persisted = await loadPersistedRuns();
  const merged = new Map(persisted.map((run) => [run.id, run]));
  for (const [id, run] of runs()) merged.set(id, run);
  const all = [...merged.values()];
  return (agentId ? all.filter((run) => run.agentId === agentId) : all).slice(-12).reverse();
}

/** Rolling 24h spend for one agent, read from the persisted ledger. */
export function spentToday(ledger: LedgerEntry[], agentId?: string): number {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return ledger
    .filter(
      (entry) =>
        entry.decision === 'settled' &&
        Date.parse(entry.at) > cutoff &&
        (agentId ? entry.agentId === agentId || entry.agentId === undefined : true),
    )
    .reduce((sum, entry) => sum + entry.price, 0);
}

const PLAN: Record<Run['mode'], string[]> = {
  normal: ['market-intel', 'summarize', 'brief-writer'],
  rogue: ['premium-intel', 'market-intel'],
};

export interface StartRunInput {
  agentId?: string | null;
  goal: string;
  mode?: Run['mode'];
  baseUrl: string;
}

/**
 * Kicks off a run and returns immediately; the UI polls for progress. Each step
 * is a real HTTP 402 dance against our own paid endpoints, so what the UI shows
 * is what actually happened on the wire.
 */
/**
 * Runs the whole pipeline inside the request and returns the finished run.
 *
 * It used to return immediately and execute in the background, with the UI
 * polling. That cannot work on a serverless host: the background work is killed
 * when the response is sent, and the poll can land on another instance that has
 * never heard of the run. Awaiting is slower but correct everywhere.
 */
export type RunEmit = (run: Run) => void;

export async function startRun(input: StartRunInput, emit?: RunEmit): Promise<Run> {
  const agent = await pickAgent(input.agentId);
  const run: Run = {
    id: randomUUID().slice(0, 8),
    agentId: agent.id,
    agentName: agent.name,
    goal: input.goal,
    mode: input.mode ?? 'normal',
    status: 'running',
    startedAt: new Date().toISOString(),
    policy: agent.policy,
    engine: llmLabel(),
    steps: [],
    spend: 0,
    refused: 0,
  };
  runs().set(run.id, run);
  await persistRuns();

  await execute(run, agent, input.baseUrl, emit).catch((error) => {
    run.status = 'error';
    run.error = error instanceof Error ? error.message : String(error);
    run.endedAt = new Date().toISOString();
  });

  await persistRuns();
  return run;
}

async function execute(
  run: Run,
  agent: AgentRecord,
  baseUrl: string,
  emit?: RunEmit,
): Promise<void> {
  await bootstrap();
  const state = await getState();
  if (!state.mint) throw new Error('devnet is not ready');
  const mint = new PublicKey(state.mint);

  // No top-up here on purpose: an agent that runs out of runway must be refused,
  // not quietly refilled. Funding is an operator action.
  const { treasury } = await wallets();
  const agentKeypair = keypairFor(agent);
  const ledger = await getLedger();
  let spent = spentToday(ledger, agent.id);

  run.policy = agent.policy;

  const currentBalance = await tokenBalanceOf(mint, agentKeypair.publicKey);

  const performStep = async (
    index: number,
    serviceId: string,
    context: unknown,
  ): Promise<void> => {
    const definition = serviceById(serviceId);
    if (!definition) return;

    const step: RunStep = {
      index,
      serviceId,
      serviceName: definition.name,
      price: definition.price,
      status: 'quoting',
      cardFee: cardFeeFor(definition.price),
      startedAt: new Date().toISOString(),
    };
    run.steps.push(step);
    run.steps.sort((a, b) => a.index - b.index);
    emit?.(run);

    // Each step consumes whatever the previous step bought. Steps that share the
    // same input can run at once, which is how the two model calls overlap.

    // Balance is read once before the loop and decremented as we spend; a fresh
    // RPC read per step cost ~200ms each and told us nothing new.
    let balance = currentBalance;

    try {
      step.status = 'settling';
      const result = await paidCall({
        baseUrl,
        serviceId,
        query: run.goal,
        runId: run.id,
        context,
        agentToken: agent.token,
        policy: agent.policy,
        spentToday: spent,
        agentBalance: balance,
        agent: agentKeypair,
        treasury,
        mint,
      });

      if (result.status === 'settled') {
        const payload = result.data as {
          output?: unknown;
          engine?: 'fetch' | 'model' | 'deterministic';
          source?: 'live' | 'cached';
          note?: string;
          model?: string;
          computeMs?: number;
        };
        step.status = 'settled';
        step.quote = result.quote;
        step.signature = result.signature;
        step.settleMs = result.settleMs;
        step.verifyMs = result.verifyMs;
        step.computeMs = payload.computeMs;
        step.output = payload.output;
        step.engine = payload.engine;
        step.model = payload.model;
        step.source = payload.source;
        step.note = payload.note;
        step.price = result.quote.price;
        spent += result.quote.price;
        balance -= result.quote.price;
        run.spend += result.quote.price;

        await appendLedger({
          id: `${run.id}-${index}`,
          runId: run.id,
          agentId: agent.id,
          at: new Date().toISOString(),
          serviceId,
          serviceName: definition.name,
          price: result.quote.price,
          decision: 'settled',
          signature: result.signature,
          settleMs: result.settleMs,
          agentBalanceAfter: balance,
          cardFee: cardFeeFor(result.quote.price),
        });
      } else if (result.status === 'refused') {
        step.status = 'denied';
        step.reason = result.reason;
        step.quote = result.quote;
        step.price = result.quote.price;
        run.refused += 1;
        await appendLedger({
          id: `${run.id}-${index}`,
          runId: run.id,
          agentId: agent.id,
          at: new Date().toISOString(),
          serviceId,
          serviceName: definition.name,
          price: result.quote.price,
          decision: 'refused',
          reason: result.reason,
          agentBalanceAfter: balance,
          cardFee: cardFeeFor(result.quote.price),
        });
      } else {
        step.status = 'error';
        step.reason = result.reason;
        step.quote = result.quote;
        await appendLedger({
          id: `${run.id}-${index}`,
          runId: run.id,
          agentId: agent.id,
          at: new Date().toISOString(),
          serviceId,
          serviceName: definition.name,
          price: result.quote?.price ?? definition.price,
          decision: 'error',
          reason: result.reason,
          agentBalanceAfter: balance,
        });
      }
    } catch (error) {
      step.status = 'error';
      step.reason = error instanceof Error ? error.message : String(error);
    } finally {
      step.endedAt = new Date().toISOString();
      // Persist after every step: if the function is killed mid-run, the record
      // shows how far it got instead of hanging in "running".
      await persistRuns();
      emit?.(run);
    }
  };

  const plan = PLAN[run.mode];

  if (run.mode === 'normal') {
    // Fetch the signals first: both model steps read them, and running them at
    // the same time removes ~3s of dead waiting from the run.
    await performStep(0, plan[0], null);
    const signals = run.steps.find((step) => step.index === 0)?.output ?? null;
    await Promise.all([performStep(1, plan[1], signals), performStep(2, plan[2], signals)]);
  } else {
    // Rogue mode is deliberately sequential: each step reacts to the last.
    let context: unknown = null;
    for (const [index, serviceId] of plan.entries()) {
      await performStep(index, serviceId, context);
      context = run.steps.find((step) => step.index === index)?.output ?? null;
    }
  }

  const brief = run.steps.find((step) => step.serviceId === 'brief-writer' && step.status === 'settled');
  const output = brief?.output as { memo?: string } | undefined;
  run.verdict = output?.memo;
  run.status = 'complete';
  run.endedAt = new Date().toISOString();
}
