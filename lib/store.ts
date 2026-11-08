import { DEFAULT_POLICY, type Policy } from './config';
import { readDocument, writeDocument } from './persist';

export interface PersistedState {
  mint: string | null;
  policy: Policy;
  createdAt: string;
  bootstrapCount: number;
}

export type LedgerDecision = 'settled' | 'refused' | 'error' | 'funded';

export interface LedgerEntry {
  id: string;
  runId: string;
  /** Which agent spent this. Absent on records written before agents existed. */
  agentId?: string;
  at: string;
  serviceId: string;
  serviceName: string;
  price: number;
  decision: LedgerDecision;
  /** Why a payment was refused, in words a human can act on. */
  reason?: string;
  signature?: string;
  /** Milliseconds from "sign" to "confirmed on devnet". */
  settleMs?: number;
  /** Tokens the agent had left after this attempt. */
  agentBalanceAfter?: number;
  /** The modelled fee a card processor would have charged for this sale. */
  cardFee?: number;
}

const defaultState = (): PersistedState => ({
  mint: null,
  policy: { ...DEFAULT_POLICY, allowlist: [...DEFAULT_POLICY.allowlist] },
  createdAt: new Date().toISOString(),
  bootstrapCount: 0,
});


const globalForStore = globalThis as unknown as {
  __stipendState?: PersistedState;
  __stipendLedger?: LedgerEntry[];
  __stipendStoreLock?: Promise<unknown>;
};

export async function getState(): Promise<PersistedState> {
  if (!globalForStore.__stipendState) {
    globalForStore.__stipendState = { ...defaultState(), ...(await readDocument('state', {})) };
  }
  return globalForStore.__stipendState;
}

export async function patchState(patch: Partial<PersistedState>): Promise<PersistedState> {
  const current = await getState();
  const next = { ...current, ...patch };
  globalForStore.__stipendState = next;
  await writeDocument('state', next);
  return next;
}

export async function getLedger(): Promise<LedgerEntry[]> {
  if (!globalForStore.__stipendLedger) {
    globalForStore.__stipendLedger = await readDocument<LedgerEntry[]>('ledger', []);
  }
  return globalForStore.__stipendLedger;
}

export async function appendLedger(entry: LedgerEntry): Promise<void> {
  const ledger = await getLedger();
  ledger.unshift(entry);
  // The demo cares about the last few hundred calls; the file should not grow forever.
  if (ledger.length > 300) ledger.length = 300;
  await writeDocument('ledger', ledger);
}

export async function clearLedger(): Promise<void> {
  globalForStore.__stipendLedger = [];
  await writeDocument('ledger', []);
}

/** Serialises bootstraps so two clicks cannot race to create two mints. */
export async function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = globalForStore.__stipendStoreLock ?? Promise.resolve();
  const next = previous.then(fn, fn);
  globalForStore.__stipendStoreLock = next.catch(() => undefined);
  return next;
}
