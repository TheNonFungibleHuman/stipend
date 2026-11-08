import { bumpCounter } from './persist';

/**
 * The vendors are market-research vendors, not an assistant. Two layers keep
 * them from becoming a general-purpose chatbot on someone else's model bill:
 *
 *  1. a deterministic screen that rejects obviously off-topic requests before
 *     any money moves, and
 *  2. a rate limit on model calls, per caller, so the key behind them cannot be
 *     farmed even by a caller that stays on topic.
 */
export type GuardCode = 'too-short' | 'too-long' | 'off-topic';

export interface GuardResult {
  allowed: boolean;
  code?: GuardCode;
  reason?: string;
}

const OFF_TOPIC: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(write|compose|draft|generate)\b.{0,40}\b(poem|story|essay|song|joke|resume|cv|cover letter|email)\b/i, label: 'creative or personal writing' },
  { pattern: /\b(tell|give|say)\b.{0,20}\b(joke|poem|story|riddle|quote|fun fact)\b/i, label: 'creative or personal writing' },
  { pattern: /\b(a|another)\s+(joke|poem|story|riddle)\b/i, label: 'creative or personal writing' },
  { pattern: /\btranslate\b|\btranslation\b/i, label: 'translation' },
  { pattern: /\b(who|what)\s+(is|was|are)\s+(the\s+)?(president|capital|king|queen|prime minister)\b/i, label: 'general trivia' },
  { pattern: /\b(recipe|cook|bake|calorie)\b/i, label: 'cooking' },
  { pattern: /\b(medical|diagnose|symptom|prescription|dosage|legal advice|lawyer|sue)\b/i, label: 'medical or legal advice' },
  { pattern: /\b(homework|solve this equation|math problem)\b/i, label: 'homework' },
  { pattern: /\b(write|fix|debug|refactor)\b.{0,30}\b(code|function|script|app|component|program)\b/i, label: 'coding help' },
  { pattern: /\b(personal|relationship|dating)\s+advice\b/i, label: 'personal advice' },
  { pattern: /\b(weather|forecast|news today|stock tip|score)\b/i, label: 'live general lookup' },
  { pattern: /\b(chat with me|talk to me about|act as|pretend to be|roleplay|role play)\b/i, label: 'general assistant use' },
];

const ON_TOPIC = [
  'market', 'pricing', 'price', 'competitor', 'competition', 'launch', 'revenue', 'churn',
  'growth', 'adoption', 'startup', 'product', 'industry', 'token', 'solana', 'crypto', 'saas',
  'api', 'customer', 'users', 'paywall', 'subscription', 'monetis', 'monetiz', 'demand',
  'positioning', 'segment', 'usage-based', 'per-call', 'agent', 'observability',
];

/**
 * Word-boundary matching, not substring: "therapist" contains "api", and that
 * single overlap was enough to let a role-play prompt through.
 */
const ON_TOPIC_RE = new RegExp(`\\b(${ON_TOPIC.map((word) => word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})`, 'i');

export function reviewQuery(query: string): GuardResult {
  const text = (query ?? '').trim();

  if (text.length < 4) {
    return { allowed: false, code: 'too-short', reason: 'give the vendor something to research' };
  }
  if (text.length > 300) {
    return { allowed: false, code: 'too-long', reason: 'queries are limited to 300 characters' };
  }

  const hasTopic = ON_TOPIC_RE.test(text);
  const offTopic = OFF_TOPIC.find((entry) => entry.pattern.test(text));

  if (offTopic && !hasTopic) {
    return {
      allowed: false,
      code: 'off-topic',
      reason: `this vendor answers market and pricing questions, not ${offTopic.label}`,
    };
  }

  return { allowed: true };
}

/** The prompt-side half of the same rule, for anything that slips past the screen. */
export const VENDOR_SYSTEM_RULE =
  'You only work on market, pricing, product and competitor research. If the request is anything ' +
  'else, reply with exactly REFUSE and nothing else.';

export function refusedByModel(text: string): boolean {
  return /^\s*REFUSE\s*$/i.test(text);
}

const HOUR = 60 * 60 * 1000;

/** Cheap calls: challenge, status, paid vendor hits. */
export async function allowVendorCall(identity: string): Promise<boolean> {
  const count = await bumpCounter(`vendor:${identity}`, HOUR);
  return count <= 240;
}

/** Expensive calls: anything that reaches the model. */
export async function allowModelCall(identity: string): Promise<boolean> {
  const count = await bumpCounter(`model:${identity}`, HOUR);
  return count <= 60;
}

export function callerIdentity(request: Request, token?: string | null): string {
  if (token) return `t:${token.slice(0, 12)}`;
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
  return `ip:${ip}`;
}

/** Hard ceiling on model calls inside one run, so a loop cannot drain the key. */
export const MAX_MODEL_CALLS_PER_RUN = 3;
