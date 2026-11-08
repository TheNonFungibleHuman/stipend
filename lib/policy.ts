import { ONE_TOKEN, type Policy } from './config';

/**
 * The spending policy is a pure function on purpose: it runs between the 402
 * and the signature, it is the only thing standing between an agent and a
 * payee, and it must be testable without a network.
 */
export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; code: 'not-allowed' | 'per-call' | 'daily' | 'balance'; message: string };

export interface PolicyInput {
  policy: Policy;
  serviceId: string;
  price: number;
  /** Tokens already spent in the current window, in base units. */
  spentToday: number;
  /** Tokens the agent currently holds, in base units. */
  agentBalance: number;
}

function dollars(baseUnits: number): string {
  return `$${(baseUnits / ONE_TOKEN).toFixed(2)}`;
}

export function evaluate(input: PolicyInput): PolicyDecision {
  const { policy, serviceId, price, spentToday, agentBalance } = input;

  if (policy.allowlist.length > 0 && !policy.allowlist.includes(serviceId)) {
    return {
      allowed: false,
      code: 'not-allowed',
      message: `${serviceId} is not on the payee allowlist`,
    };
  }

  if (price > policy.perCallCap) {
    return {
      allowed: false,
      code: 'per-call',
      message: `${dollars(price)} is over the ${dollars(policy.perCallCap)} per-call cap`,
    };
  }

  if (spentToday + price > policy.dailyCap) {
    return {
      allowed: false,
      code: 'daily',
      message: `would reach ${dollars(spentToday + price)}, over the ${dollars(policy.dailyCap)} daily budget`,
    };
  }

  if (price > agentBalance) {
    return {
      allowed: false,
      code: 'balance',
      message: `agent holds ${dollars(agentBalance)}, needs ${dollars(price)}`,
    };
  }

  return { allowed: true };
}

/** The card rails the product is arguing against, for the comparison panel. */
export function cardFeeFor(price: number): number {
  return Math.round(price * 0.029) + 30_000; // 2.9% + $0.30 in base units
}
