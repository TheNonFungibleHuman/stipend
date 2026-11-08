import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { DEFAULT_POLICY, DEVNET_DIR, type Policy } from './config';

/**
 * Agents are first-class records, not a hardcoded keypair. Creating one is the
 * first thing a user does, so it has to be real: a fresh keypair, its own
 * policy, its own API token, its own ledger.
 *
 * The secret key is held by this server for the scope of the demo. In
 * production that key would live in the caller's infrastructure; the API token
 * below is what a real deployment would hand the agent instead.
 */
export interface AgentRecord {
  id: string;
  name: string;
  /** Base58 secret key. Server-side only — never sent to the browser. */
  secret: string;
  /** Bearer token the agent presents when it asks for data, and the owner's console key. */
  token: string;
  /**
   * A second, weaker key: it opens this agent's dashboard read-only and can do
   * nothing else. Sharing a dashboard must never hand over the key that spends.
   */
  viewToken: string;
  policy: Policy;
  createdAt: string;
  demo?: boolean;
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
  /** Filled in by the route when devnet is up. */
  tokensRaw?: number;
}

const FILE = path.join(DEVNET_DIR, 'agents.json');

const globalForAgents = globalThis as unknown as {
  __stipendAgents?: AgentRecord[];
  __stipendAgentsLock?: Promise<unknown>;
};

async function read(): Promise<AgentRecord[]> {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw) as { agents?: AgentRecord[] };
    return Array.isArray(parsed.agents) ? parsed.agents : [];
  } catch {
    return [];
  }
}

async function write(agents: AgentRecord[]): Promise<void> {
  await fs.mkdir(DEVNET_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify({ agents }, null, 2), 'utf8');
  globalForAgents.__stipendAgents = agents;
}

export async function allAgents(): Promise<AgentRecord[]> {
  if (!globalForAgents.__stipendAgents) {
    const records = await read();
    // Records written before view tokens existed still need a share key.
    let migrated = false;
    for (const record of records) {
      if (!record.viewToken) {
        record.viewToken = `stp_view_${randomBytes(18).toString('base64url')}`;
        migrated = true;
      }
    }
    if (migrated) await write(records);
    globalForAgents.__stipendAgents = records;
  }
  return globalForAgents.__stipendAgents;
}

export function keypairFor(record: AgentRecord): Keypair {
  return Keypair.fromSecretKey(bs58.decode(record.secret));
}

export function addressOf(record: AgentRecord): string {
  return keypairFor(record).publicKey.toBase58();
}

export function toPublic(record: AgentRecord, tokensRaw?: number): PublicAgent {
  return {
    id: record.id,
    name: record.name,
    address: addressOf(record),
    token: record.token,
    viewToken: record.viewToken,
    policy: record.policy,
    createdAt: record.createdAt,
    demo: record.demo === true,
    tokensRaw,
  };
}

/** Serialised so two tabs cannot create two demo agents at once. */
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = globalForAgents.__stipendAgentsLock ?? Promise.resolve();
  const next = previous.then(fn, fn);
  globalForAgents.__stipendAgentsLock = next.catch(() => undefined);
  return next;
}

export async function getAgent(id: string): Promise<AgentRecord | undefined> {
  return (await allAgents()).find((agent) => agent.id === id);
}

export async function createAgent(input: {
  name: string;
  policy?: Partial<Policy>;
  demo?: boolean;
}): Promise<AgentRecord> {
  return withLock(async () => {
    const agents = await allAgents();
    const record: AgentRecord = {
      id: randomUUID().slice(0, 8),
      name: input.name.trim().slice(0, 40) || 'Untitled agent',
      secret: bs58.encode(Keypair.generate().secretKey),
      token: `stp_${randomBytes(18).toString('base64url')}`,
      viewToken: `stp_view_${randomBytes(18).toString('base64url')}`,
      policy: {
        perCallCap: input.policy?.perCallCap ?? DEFAULT_POLICY.perCallCap,
        dailyCap: input.policy?.dailyCap ?? DEFAULT_POLICY.dailyCap,
        allowlist: input.policy?.allowlist ?? [...DEFAULT_POLICY.allowlist],
      },
      createdAt: new Date().toISOString(),
      demo: input.demo,
    };
    await write([...agents, record]);
    return record;
  });
}

export async function setPolicy(id: string, patch: Partial<Policy>): Promise<Policy | null> {
  return withLock(async () => {
    const agents = await allAgents();
    const index = agents.findIndex((agent) => agent.id === id);
    if (index === -1) return null;
    const next: Policy = {
      perCallCap: patch.perCallCap ?? agents[index].policy.perCallCap,
      dailyCap: patch.dailyCap ?? agents[index].policy.dailyCap,
      allowlist: patch.allowlist ?? agents[index].policy.allowlist,
    };
    agents[index] = { ...agents[index], policy: next };
    await write([...agents]);
    return next;
  });
}

/** The demo agent exists so a visitor can see the machine work before signing up. */
export async function ensureDemoAgent(): Promise<AgentRecord> {
  const agents = await allAgents();
  const existing = agents.find((agent) => agent.demo);
  if (existing) return existing;
  return createAgent({ name: 'Atlas (demo)', demo: true });
}

export async function pickAgent(id?: string | null): Promise<AgentRecord> {  if (id) {
    const found = await getAgent(id);
    if (found) return found;
  }
  const agents = await allAgents();
  return agents.find((agent) => agent.demo) ?? (await ensureDemoAgent());
}

export function publicKeyOf(record: AgentRecord): PublicKey {
  return keypairFor(record).publicKey;
}

/** The vendor side resolves a caller from the token the agent presents. */
export async function agentByToken(token: string): Promise<AgentRecord | undefined> {
  if (!token.startsWith('stp_') || token.startsWith('stp_view_')) return undefined;
  return (await allAgents()).find((agent) => agent.token === token);
}

/** A view token opens exactly one dashboard and can do nothing else. */
export async function agentByViewToken(token: string): Promise<AgentRecord | undefined> {
  if (!token.startsWith('stp_view_')) return undefined;
  return (await allAgents()).find((agent) => agent.viewToken === token);
}

/**
 * Mutations carry the owner's key when they come from a keyed console link, so
 * one operator's link can never edit another agent. A request without the header
 * is the local operator on their own machine.
 */
export async function canMutate(request: Request, agentId: string): Promise<boolean> {
  const token = request.headers.get('x-agent-token');
  if (!token) return true;
  const owner = await agentByToken(token);
  return Boolean(owner && owner.id === agentId);
}
