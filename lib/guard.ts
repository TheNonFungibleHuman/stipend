import { bumpCounter } from './persist';

/**
 * The vendors answer whatever they are asked, and the protection is economic
 * rather than semantic.
 *
 * There used to be a topic screen here that refused anything that was not
 * market research. It was doing security work that the price should do: every
 * call is paid, capped per call, capped per day, and rate limited per caller, so
 * a caller that abuses the model pays for it and stops at the cap. A semantic
 * screen on top of that mostly produced false refusals — a customer asking a
 * perfectly reasonable question was told it was out of scope.
 *
 * What is left is hygiene: reject empty and oversized input, and keep the two
 * rate limits so a single caller cannot farm the model key.
 */
export type GuardCode = 'too-short' | 'too-long';

export interface GuardResult {
  allowed: boolean;
  code?: GuardCode;
  reason?: string;
}

export function reviewQuery(query: string): GuardResult {
  const text = (query ?? '').trim();

  if (text.length < 4) {
    return { allowed: false, code: 'too-short', reason: 'give the vendor something to work with' };
  }
  if (text.length > 300) {
    return { allowed: false, code: 'too-long', reason: 'queries are limited to 300 characters' };
  }

  return { allowed: true };
}

/** Kept for callers that still want to check a model reply for an explicit refusal. */
export function refusedByModel(text: string): boolean {
  return /^\s*REFUSE\.?\s*$/i.test(text);
}

const HOUR = 60 * 60 * 1000;

/** Cheap calls: challenge, status, paid vendor hits. */
export async function allowVendorCall(identity: string): Promise<boolean> {
  const count = await bumpCounter(`vendor:${identity}`, HOUR);
  return count <= 240;
}

/** Model calls cost real money, so they get a tighter budget per caller. */
export async function allowModelCall(identity: string): Promise<boolean> {
  const count = await bumpCounter(`model:${identity}`, HOUR);
  return count <= 60;
}

/** A caller identity we can rate limit: the agent token, else the client address. */
export function callerIdentity(request: Request, token?: string | null): string {
  const key = token ?? request.headers.get('x-agent-token');
  if (key) return `t:${key.slice(0, 18)}`;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return `ip:${forwarded.split(',')[0]!.trim()}`;
  return 'ip:local';
}
