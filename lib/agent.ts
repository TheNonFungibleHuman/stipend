import { randomUUID } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { keypairFor, pickAgent, type AgentRecord } from './agents';
import { bootstrap, provisionAgent, tokenBalanceOf } from './bootstrap';
import { serviceById, type Policy } from './config';
import { llmLabel } from './llm';
import { paidCall, type Quote } from './pay';
import { cardFeeFor } from './policy';
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
  output?: unknown;
  engine?: 'model' | 'deterministic';
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

export function getRun(id: string): Run | undefined {
  return runs().get(id);
}

export function listRuns(agentId?: string): Run[] {
  const all = [...runs().values()];
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
export async function startRun(input: StartRunInput): Promise<Run> {
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
  void execute(run, agent, input.baseUrl).catch((error) => {
    run.status = 'error';
    run.error = error instanceof Error ? error.message : String(error);
    run.endedAt = new Date().toISOString();
  });
  return run;
}

async function execute(run: Run, agent: AgentRecord, baseUrl: string): Promise<void> {
  await bootstrap();
  const state = await getState();
  if (!state.mint) throw new Error('devnet is not ready');
  const mint = new PublicKey(state.mint);

  // Top the agent up before it starts, so a run is never cut short by runway.
  await provisionAgent(agent, mint);

  const { treasury } = await wallets();
  const agentKeypair = keypairFor(agent);
  const ledger = await getLedger();
  let spent = spentToday(ledger, agent.id);

  run.policy = agent.policy;

  for (const [index, serviceId] of PLAN[run.mode].entries()) {
    const definition = serviceById(serviceId);
    if (!definition) continue;

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

    // Each step consumes whatever the previous step bought.
    const previous = run.steps[index - 1];
    const context = previous?.output ?? null;

    // The agent's live balance is read fresh each step: it is the real limit.
    let balance = await tokenBalanceOf(mint, agentKeypair.publicKey);

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
          engine?: 'model' | 'deterministic';
          model?: string;
        };
        step.status = 'settled';
        step.quote = result.quote;
        step.signature = result.signature;
        step.settleMs = result.settleMs;
        step.verifyMs = result.verifyMs;
        step.output = payload.output;
        step.engine = payload.engine;
        step.model = payload.model;
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
        run.refused += 1;
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
    }
  }

  const brief = run.steps.find((step) => step.serviceId === 'brief-writer' && step.status === 'settled');
  const output = brief?.output as { memo?: string } | undefined;
  run.verdict = output?.memo;
  run.status = 'complete';
  run.endedAt = new Date().toISOString();
}
