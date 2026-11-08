import fs from 'node:fs/promises';
import path from 'node:path';
import { DEVNET_DIR } from './config';

/**
 * Storage that works in both worlds.
 *
 * Locally this is a JSON file under .devnet/. On a serverless host there is no
 * persistent disk, so when Upstash Redis credentials are present every document
 * goes to Redis instead. Nothing else in the app needs to know which is in use.
 */
const KV_URL = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? '';
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '';

export const usingKv = Boolean(KV_URL && KV_TOKEN);

async function kv(command: unknown[]): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(KV_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`store responded ${response.status}`);
      const body = (await response.json()) as { result?: unknown; error?: string };
      if (body.error) throw new Error(body.error);
      return body.result;
    } catch (error) {
      // DNS and connection resets happen; a retry is cheaper than a failed run.
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('store unavailable');
}

function fileFor(key: string): string {
  return path.join(DEVNET_DIR, `${key}.json`);
}

export async function readDocument<T>(key: string, fallback: T): Promise<T> {
  if (usingKv) {
    try {
      const raw = await kv(['GET', `stipend:${key}`]);
      if (typeof raw !== 'string' || raw.length === 0) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  try {
    const raw = await fs.readFile(fileFor(key), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeDocument(key: string, value: unknown): Promise<void> {
  const serialised = JSON.stringify(value);

  if (usingKv) {
    await kv(['SET', `stipend:${key}`, serialised]);
    return;
  }

  await fs.mkdir(DEVNET_DIR, { recursive: true });
  await fs.writeFile(fileFor(key), serialised, 'utf8');
}

/**
 * Counters for rate limiting. Local: process memory. Deployed: Redis, so the
 * budget is shared across every instance instead of resetting per lambda.
 */
const counters = new Map<string, { count: number; resetAt: number }>();

export async function bumpCounter(key: string, windowMs: number): Promise<number> {
  if (usingKv) {
    const namespaced = `stipend:rl:${key}`;
    const count = Number(await kv(['INCR', namespaced]));
    if (count === 1) await kv(['PEXPIRE', namespaced, windowMs]);
    return count;
  }

  const now = Date.now();
  const existing = counters.get(key);
  if (!existing || existing.resetAt < now) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  existing.count += 1;
  return existing.count;
}

export function storageLabel(): string {
  return usingKv ? 'upstash redis' : 'local files';
}
