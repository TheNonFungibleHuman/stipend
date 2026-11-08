import { NextResponse } from 'next/server';
import { z } from 'zod';
import { allAgents, createAgent, toPublic } from '@/lib/agents';
import { bootstrap, invalidateSnapshot, provisionAgent } from '@/lib/bootstrap';
import { getState } from '@/lib/store';
import { PublicKey } from '@solana/web3.js';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(1).max(40),
  perCallCap: z.number().int().min(1_000).max(1_000_000_000).optional(),
  dailyCap: z.number().int().min(10_000).max(1_000_000_000).optional(),
  allowlist: z.array(z.string()).max(10).optional(),
});

export async function GET() {
  const agents = await allAgents();
  return NextResponse.json({ agents: agents.map((agent) => toPublic(agent)) });
}

/**
 * Creating an agent is the first thing a user does: a keypair, a policy and an
 * API token. On devnet it also gets a funded token account, so it can work
 * immediately instead of after a second setup step.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'a name between 1 and 40 characters is required' }, { status: 400 });
  }

  const record = await createAgent({
    name: parsed.data.name,
    policy: {
      perCallCap: parsed.data.perCallCap,
      dailyCap: parsed.data.dailyCap,
      allowlist: parsed.data.allowlist,
    },
  });

  // Devnet may not be commissioned yet; the agent record still exists and can
  // be funded later, so onboarding never dead-ends.
  let tokensRaw: number | undefined;
  try {
    await bootstrap();
    const state = await getState();
    if (state.mint) tokensRaw = await provisionAgent(record, new PublicKey(state.mint));
  } catch {
    tokensRaw = undefined;
  }

  invalidateSnapshot();
  return NextResponse.json({ agent: toPublic(record, tokensRaw) });
}
