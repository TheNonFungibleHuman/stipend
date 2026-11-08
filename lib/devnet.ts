import { Connection } from '@solana/web3.js';
import { RPC_URL } from './config';

/**
 * One shared connection. Route handlers are short-lived, so the connection is
 * cached on globalThis to survive Next's dev-mode module reloads.
 */
const globalForChain = globalThis as unknown as { __stipendConnection?: Connection };

export function connection(): Connection {
  if (!globalForChain.__stipendConnection) {
    globalForChain.__stipendConnection = new Connection(RPC_URL, {
      commitment: 'confirmed',
      disableRetryOnRateLimit: false,
    });
  }
  return globalForChain.__stipendConnection;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Public devnet drops requests under load. Retrying with backoff is the
 * difference between a demo that survives a bad minute and one that does not.
 */
export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 4,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /429|rate limit|timed out|timeout|fetch failed|ECONN|socket hang up|blockhash not found/i.test(
        message,
      );
      if (!retryable || attempt === attempts) break;
      await sleep(250 * attempt * attempt);
    }
  }
  throw new Error(`${label} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

/** Milliseconds from now, for latency reporting in the UI. */
export function nowMs(): number {
  return Date.now();
}

/**
 * Poll a signature until it is confirmed or the budget runs out. We poll rather
 * than use confirmTransaction because we want to report the real settle time.
 */
export async function confirmSignature(
  signature: string,
  timeoutMs = 30_000,
): Promise<{ confirmedAt: number; elapsedMs: number }> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await withRetry('getSignatureStatuses', () =>
      connection().getSignatureStatuses([signature], { searchTransactionHistory: true }),
    );
    const value = status.value[0];
    if (value?.err) {
      throw new Error(`transaction ${signature} failed: ${JSON.stringify(value.err)}`);
    }
    if (value && (value.confirmationStatus === 'confirmed' || value.confirmationStatus === 'finalized')) {
      return { confirmedAt: Date.now(), elapsedMs: Date.now() - started };
    }
    await sleep(150);
  }
  throw new Error(`transaction ${signature} did not confirm within ${timeoutMs}ms`);
}

