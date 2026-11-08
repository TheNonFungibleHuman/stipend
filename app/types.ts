/** Client-side mirrors of the API payloads. Kept separate so no server module
 *  (and no node built-in) can leak into the browser bundle. */

export interface Quote {
  scheme: 'exact';
  network: string;
  serviceId: string;
  price: number;
  payee: string;
  mint: string;
}

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
  engine: string;
  steps: RunStep[];
  spend: number;
  refused: number;
  verdict?: string;
  error?: string;
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

export interface LedgerEntry {
  id: string;
  runId: string;
  agentId?: string;
  at: string;
  serviceId: string;
  serviceName: string;
  price: number;
  decision: 'settled' | 'refused' | 'error' | 'funded';
  reason?: string;
  signature?: string;
  settleMs?: number;
  agentBalanceAfter?: number;
  cardFee?: number;
}

export interface Policy {
  perCallCap: number;
  dailyCap: number;
  allowlist: string[];
}

export interface ChainSnapshot {
  mint: string;
  mintSymbol: string;
  decimals: number;
  rpcHost: string;
  network: 'devnet';
  treasury: { address: string; sol: number; tokensRaw: number };
  agent: { id: string; name: string; address: string; tokensRaw: number };
  providers: Array<{ id: string; address: string; tokensRaw: number }>;
  policy: Policy;
  ready: boolean;
}

export interface PublicAgent {
  id: string;
  name: string;
  address: string;
  token: string;
  viewToken: string;
  policy: Policy;
  createdAt: string;
  demo: boolean;
  tokensRaw?: number;
}

export interface ServiceDef {
  id: string;
  name: string;
  blurb: string;
  price: number;
}

export interface StateResponse {
  ok: boolean;
  needsFunding?: boolean;
  fixture?: boolean;
  readOnly?: boolean;
  treasuryAddress?: string;
  solBalance?: number;
  faucetUrl?: string;
  message?: string;
  error?: string;
  snapshot?: ChainSnapshot;
  policy?: Policy;
  spentToday?: number;
  ledger?: LedgerEntry[];
  services?: ServiceDef[];
  hostileService?: ServiceDef;
  llm?: { configured: boolean; label: string };
  runs?: Run[];
  runSummaries?: RunSummary[];
  agents?: PublicAgent[];
  activeAgentId?: string;
}

export const ONE = 1_000_000;

export function usd(baseUnits: number, digits = 2): string {
  return `$${(baseUnits / ONE).toFixed(digits)}`;
}

export function shortAddress(value: string, size = 4): string {
  return value.length <= size * 2 + 3 ? value : `${value.slice(0, size)}…${value.slice(-size)}`;
}

export function explorerTx(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function clockOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
