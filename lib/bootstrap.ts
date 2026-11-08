import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  mintTo,
} from '@solana/spl-token';
import { Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { addressOf, ensureDemoAgent, getAgent, pickAgent, publicKeyOf, type AgentRecord } from './agents';
import {
  AGENT_TOKEN_GRANT,
  ALL_SERVICES,
  RPC_URL,
  SERVICES,
  TOKEN_DECIMALS,
  TREASURY_MIN_LAMPORTS,
  TREASURY_TOPUP_LAMPORTS,
  type Policy,
} from './config';
import { confirmSignature, connection, withRetry } from './devnet';
import { appendLedger, getState, patchState, withStoreLock } from './store';
import { wallets } from './wallets';

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

const globalForBootstrap = globalThis as unknown as { __stipendBootstrap?: Promise<void> };

async function solBalance(address: PublicKey): Promise<number> {
  return withRetry('getBalance', () => connection().getBalance(address, 'confirmed'));
}

async function requestAirdrop(address: PublicKey, lamports: number): Promise<void> {
  const signature = await withRetry('requestAirdrop', () =>
    connection().requestAirdrop(address, lamports),
  );
  await confirmSignature(signature, 40_000);
}

/**
 * The public devnet faucet is closed (`410 Gone`), so this can only top itself
 * up on clusters that still allow it. When it cannot, the app asks its operator
 * for a one-time transfer instead of pretending to work.
 */
export class FundingRequiredError extends Error {
  readonly address: string;
  readonly solBalance: number;

  constructor(address: string, solBalance: number) {
    super('treasury needs SOL before it can pay devnet fees');
    this.name = 'FundingRequiredError';
    this.address = address;
    this.solBalance = solBalance;
  }
}

/** The treasury pays every fee, so it needs a little SOL of its own. */
async function ensureTreasurySol(treasury: Keypair): Promise<void> {
  const balance = await solBalance(treasury.publicKey);
  if (balance >= TREASURY_MIN_LAMPORTS) return;

  for (const lamports of [TREASURY_TOPUP_LAMPORTS, Math.floor(TREASURY_TOPUP_LAMPORTS / 4)]) {
    try {
      await requestAirdrop(treasury.publicKey, lamports);
      return;
    } catch {
      // Faucet closed or rate limited; fall through to the explicit ask.
    }
  }

  const after = await solBalance(treasury.publicKey);
  if (after < TREASURY_MIN_LAMPORTS) {
    throw new FundingRequiredError(treasury.publicKey.toBase58(), after / 1_000_000_000);
  }
}

export async function ensureAta(
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(mint, owner, true);
  const existing = await connection().getAccountInfo(ata);
  if (existing) return ata;

  const transaction = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, owner, mint),
  );
  await withRetry('createAta', () =>
    sendAndConfirmTransaction(connection(), transaction, [payer], { commitment: 'confirmed' }),
  );
  return ata;
}

/**
 * A failed read is not a zero balance. Conflating them is how a wallet mints
 * itself free money the first time the RPC hiccups.
 */
async function readTokenBalance(ata: PublicKey): Promise<number | null> {
  try {
    const account = await getAccount(connection(), ata, 'confirmed');
    return Number(account.amount);
  } catch {
    return null;
  }
}

export async function tokenBalanceOf(mint: PublicKey, owner: PublicKey): Promise<number> {
  const balance = await readTokenBalance(getAssociatedTokenAddressSync(mint, owner, true));
  return balance ?? 0;
}

export async function tryTokenBalanceOf(mint: PublicKey, owner: PublicKey): Promise<number | null> {
  return readTokenBalance(getAssociatedTokenAddressSync(mint, owner, true));
}

async function ensureMint(treasury: Keypair): Promise<PublicKey> {
  const state = await getState();
  if (state.mint) {
    try {
      const mint = await getMint(connection(), new PublicKey(state.mint), 'confirmed');
      if (mint.decimals === TOKEN_DECIMALS) return new PublicKey(state.mint);
    } catch {
      // The mint is gone (devnet reset); fall through and make a new one.
    }
  }

  const mintAddress = await withRetry('createMint', () =>
    createMint(connection(), treasury, treasury.publicKey, treasury.publicKey, TOKEN_DECIMALS),
  );
  await patchState({ mint: mintAddress.toBase58() });
  return mintAddress;
}

/** Gives an agent enough runway to keep buying, without touching its policy. */
export async function fundAgent(
  mintAddress: PublicKey,
  owner: PublicKey,
  amount = AGENT_TOKEN_GRANT,
): Promise<void> {
  const { treasury } = await wallets();
  const ata = await ensureAta(treasury, mintAddress, owner);
  await withRetry('mintTo', () => mintTo(connection(), treasury, mintAddress, ata, treasury, amount));
}

/** Creates the agent's token account and tops it up when it is genuinely low. */
export async function provisionAgent(record: AgentRecord, mintAddress: PublicKey): Promise<number> {
  const { treasury } = await wallets();
  const owner = publicKeyOf(record);
  const ata = await ensureAta(treasury, mintAddress, owner);
  const balance = await readTokenBalance(ata);

  // Unknown balance: do nothing. Minting on a failed read would hand out free
  // runway every time devnet answered slowly.
  if (balance === null) return 0;

  if (balance < AGENT_TOKEN_GRANT / 2) {
    const amount = AGENT_TOKEN_GRANT - balance;
    await fundAgent(mintAddress, owner, amount);
    // Money entering the account belongs in the same record as money leaving it.
    await appendLedger({
      id: `fund-${record.id}-${Date.now()}`,
      runId: 'funding',
      agentId: record.id,
      at: new Date().toISOString(),
      serviceId: 'treasury',
      serviceName: 'Treasury top-up',
      price: amount,
      decision: 'funded',
      reason: 'runway refill',
      agentBalanceAfter: AGENT_TOKEN_GRANT,
    });
    return AGENT_TOKEN_GRANT;
  }
  return balance;
}

async function bootstrapOnce(): Promise<void> {
  const { treasury, providers } = await wallets();

  await ensureTreasurySol(treasury);
  const mintAddress = await ensureMint(treasury);

  await ensureAta(treasury, mintAddress, treasury.publicKey);
  for (const service of ALL_SERVICES) {
    const provider = providers.get(service.id);
    if (!provider) throw new Error(`no provider wallet for service ${service.id}`);
    await ensureAta(treasury, mintAddress, provider.publicKey);
  }

  // A fresh install starts with the demo agent so the machine can be tried
  // before anyone signs up.
  const demo = await ensureDemoAgent();
  await provisionAgent(demo, mintAddress);

  const state = await getState();
  await patchState({ bootstrapCount: state.bootstrapCount + 1 });
}

/** Idempotent, serialised setup. Safe to call on every page load. */
export function bootstrap(): Promise<void> {
  if (!globalForBootstrap.__stipendBootstrap) {
    globalForBootstrap.__stipendBootstrap = withStoreLock(bootstrapOnce).catch((error) => {
      globalForBootstrap.__stipendBootstrap = undefined;
      throw error;
    });
  }
  return globalForBootstrap.__stipendBootstrap;
}

/** Fresh read of everything the UI shows for one agent. No writes. */
export async function snapshot(agentId?: string | null): Promise<ChainSnapshot> {
  const { treasury, providers } = await wallets();
  const state = await getState();
  if (!state.mint) throw new Error('devnet not bootstrapped yet');

  const agent = await pickAgent(agentId);
  const mintAddress = new PublicKey(state.mint);
  const agentOwner = publicKeyOf(agent);

  const [treasuryTokens, agentTokens, treasurySol] = await Promise.all([
    tokenBalanceOf(mintAddress, treasury.publicKey),
    tokenBalanceOf(mintAddress, agentOwner),
    solBalance(treasury.publicKey),
  ]);

  const providerBalances = await Promise.all(
    SERVICES.map(async (service) => {
      const provider = providers.get(service.id);
      return {
        id: service.id,
        address: provider?.publicKey.toBase58() ?? 'unknown',
        tokensRaw: provider ? await tokenBalanceOf(mintAddress, provider.publicKey) : 0,
      };
    }),
  );

  return {
    mint: state.mint,
    mintSymbol: 'dUSD',
    decimals: TOKEN_DECIMALS,
    rpcHost: new URL(RPC_URL).host,
    network: 'devnet',
    treasury: {
      address: treasury.publicKey.toBase58(),
      sol: treasurySol / 1_000_000_000,
      tokensRaw: treasuryTokens,
    },
    agent: {
      id: agent.id,
      name: agent.name,
      address: agentOwner.toBase58(),
      tokensRaw: agentTokens,
    },
    providers: providerBalances,
    policy: agent.policy,
    ready: agentTokens >= 10_000,
  };
}

const globalForSnapshot = globalThis as unknown as {
  __stipendSnapshotCache?: Map<string, { at: number; value: ChainSnapshot }>;
};

/**
 * Read-only snapshot with a short TTL, keyed by agent. The UI polls, and
 * devnet's public RPC does not need a balance query per render.
 */
export async function liveSnapshot(agentId?: string | null, ttlMs = 1500): Promise<ChainSnapshot> {
  const key = agentId ?? 'default';
  const cache = (globalForSnapshot.__stipendSnapshotCache ??= new Map());
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < ttlMs) return cached.value;
  const value = await snapshot(agentId);
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function invalidateSnapshot(): void {
  globalForSnapshot.__stipendSnapshotCache = undefined;
}

export { addressOf, getAgent };
