import path from 'node:path';

/** Devnet RPC. A Helius/QuickNode URL wins when present; public devnet is the fallback. */
export const RPC_URL =
  process.env.HELIUS_RPC_URL?.trim() ||
  process.env.RPC_URL?.trim() ||
  'https://api.devnet.solana.com';

export const DEVNET_DIR = path.join(process.cwd(), '.devnet');
export const WALLET_FILE = path.join(DEVNET_DIR, 'wallets.json');
export const STATE_FILE = path.join(DEVNET_DIR, 'state.json');
export const LEDGER_FILE = path.join(DEVNET_DIR, 'ledger.json');

/** The demo stablecoin: an SPL mint we control on devnet. */
export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = 'dUSD';
export const TOKEN_NAME = 'Stipend Demo Dollar';

/** Every monetary value in the codebase is integer base units of the mint. */
export const ONE_TOKEN = 10 ** TOKEN_DECIMALS;

/** Below this, the treasury tops itself up so the demo can keep paying fees. */
export const TREASURY_MIN_LAMPORTS = 40_000_000; // 0.04 SOL
export const TREASURY_TOPUP_LAMPORTS = 400_000_000; // 0.4 SOL
export const AGENT_TOKEN_GRANT = 25 * ONE_TOKEN; // 25 dUSD of runway

export const PAYMENT_HEADER = 'x-payment';
export const PAYMENT_REQUIRED_HEADER = 'www-authenticate';

export interface ServiceDef {
  id: string;
  name: string;
  blurb: string;
  /** Price per call, in base units. */
  price: number;
}

/**
 * The catalog an agent can buy from. Prices are the point of the product:
 * at $0.02–$0.08 per call, card rails lose money on every sale.
 */
export const SERVICES: ServiceDef[] = [
  {
    id: 'market-intel',
    name: 'Signal Search',
    blurb: 'Live public discussion for the goal, fetched from the source at call time.',
    price: 40_000, // $0.04
  },
  {
    id: 'summarize',
    name: 'Summarizer',
    blurb: 'Condenses raw research into decision-grade notes.',
    price: 60_000, // $0.06
  },
  {
    id: 'brief-writer',
    name: 'Brief Writer',
    blurb: 'Turns notes into a one-page memo a human can act on.',
    price: 80_000, // $0.08
  },
];

export function serviceById(id: string): ServiceDef | undefined {
  return SERVICES.find((service) => service.id === id) ?? (id === HOSTILE_SERVICE.id ? HOSTILE_SERVICE : undefined);
}

/**
 * A vendor that quotes a hundred times the going rate. It exists so the demo can
 * show a real refusal: the agent asks, gets a real 402, and the policy stops the
 * signature before it happens.
 */
export const HOSTILE_SERVICE: ServiceDef = {
  id: 'premium-intel',
  name: 'Premium Intel',
  blurb: 'Quotes $5.00 a call. Should never be paid.',
  price: 5_000_000, // $5.00
};

/** Everything that needs a receiving wallet, including the vendor we refuse. */
export const ALL_SERVICES: ServiceDef[] = [...SERVICES, HOSTILE_SERVICE];

/** Spending policy enforced between the 402 and the signature. */
export interface Policy {
  /** Most the agent may spend on any single call. */
  perCallCap: number;
  /** Most the agent may spend across a rolling 24h window. */
  dailyCap: number;
  /** When non-empty, only these service ids may be paid. */
  allowlist: string[];
}

export const DEFAULT_POLICY: Policy = {
  perCallCap: 100_000, // $0.10
  dailyCap: 1_000_000, // $1.00
  allowlist: [],
};

export function formatTokens(baseUnits: number, decimals = 2): string {
  const value = baseUnits / ONE_TOKEN;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** dUSD amounts rendered the way a buyer thinks about them. */
export function money(baseUnits: number): string {
  return `$${formatTokens(baseUnits)}`;
}
