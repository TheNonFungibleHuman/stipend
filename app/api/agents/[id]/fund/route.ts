import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getAgent, publicKeyOf } from '@/lib/agents';
import { bootstrap, fundAgent, invalidateSnapshot, tokenBalanceOf } from '@/lib/bootstrap';
import { AGENT_TOKEN_GRANT } from '@/lib/config';
import { getState } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Tops an agent up from the treasury. On a real deployment this is a transfer
 * from the operator's wallet; here the treasury mints demo stablecoin so the
 * whole flow can be exercised end to end.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) return NextResponse.json({ error: 'no such agent' }, { status: 404 });

  try {
    await bootstrap();
    const state = await getState();
    if (!state.mint) throw new Error('devnet is not ready');
    const mint = new PublicKey(state.mint);
    const owner = publicKeyOf(agent);

    await fundAgent(mint, owner, AGENT_TOKEN_GRANT);
    const tokensRaw = await tokenBalanceOf(mint, owner);
    invalidateSnapshot();
    return NextResponse.json({ ok: true, tokensRaw });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
