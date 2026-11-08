import fs from 'node:fs/promises';
import path from 'node:path';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { ALL_SERVICES, DEVNET_DIR, WALLET_FILE } from './config';

/**
 * Every wallet in the demo is generated and held locally. Nothing here needs a
 * browser wallet, which means a live demo never depends on an extension being
 * unlocked — but every transaction it produces is real and on devnet.
 */
export interface WalletBook {
  treasury: string;
  agent: string;
  /** One receiving wallet per paid service. */
  providers: Record<string, string>;
}

async function readWalletFile(): Promise<WalletBook | null> {
  try {
    const raw = await fs.readFile(WALLET_FILE, 'utf8');
    return JSON.parse(raw) as WalletBook;
  } catch {
    return null;
  }
}

export async function loadWallets(): Promise<WalletBook> {
  const existing = await readWalletFile();
  if (existing) {
    // A wallet file written before a service existed must still work: add any
    // missing provider rather than making the operator delete state.
    const missing = ALL_SERVICES.filter((service) => !existing.providers[service.id]);
    if (missing.length === 0) return existing;
    for (const service of missing) {
      existing.providers[service.id] = bs58.encode(Keypair.generate().secretKey);
    }
    await fs.writeFile(WALLET_FILE, JSON.stringify(existing, null, 2), 'utf8');
    return existing;
  }

  await fs.mkdir(DEVNET_DIR, { recursive: true });
  const book: WalletBook = {
    treasury: bs58.encode(Keypair.generate().secretKey),
    agent: bs58.encode(Keypair.generate().secretKey),
    providers: Object.fromEntries(
      ALL_SERVICES.map((service) => [service.id, bs58.encode(Keypair.generate().secretKey)]),
    ),
  };
  await fs.writeFile(WALLET_FILE, JSON.stringify(book, null, 2), 'utf8');
  return book;
}

export function keypairFrom(secret: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(secret));
}

export interface WalletSet {
  treasury: Keypair;
  agent: Keypair;
  providers: Map<string, Keypair>;
}

const globalForWallets = globalThis as unknown as { __stipendWallets?: Promise<WalletSet> };

/** Cached across route handlers so we parse the key material once per process. */
export function wallets(): Promise<WalletSet> {
  if (!globalForWallets.__stipendWallets) {
    globalForWallets.__stipendWallets = loadWallets().then((book) => ({
      treasury: keypairFrom(book.treasury),
      agent: keypairFrom(book.agent),
      providers: new Map(
        Object.entries(book.providers).map(([id, secret]) => [id, keypairFrom(secret)]),
      ),
    }));
  }
  return globalForWallets.__stipendWallets;
}

export function walletPathForDisplay(): string {
  return path.relative(process.cwd(), WALLET_FILE);
}
