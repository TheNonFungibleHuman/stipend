import { NextResponse } from 'next/server';
import { agentByToken, addressOf, getAgent } from '@/lib/agents';
import { spentToday } from '@/lib/agent';
import { tokenBalanceOf } from '@/lib/bootstrap';
import { SERVICES } from '@/lib/config';
import { getLedger, getState } from '@/lib/store';
import { PublicKey } from '@solana/web3.js';

export const dynamic = 'force-dynamic';

/**
 * Token-authenticated status for an agent — what an MCP client or an external
 * agent calls to answer "can I afford this, and how much is left?".
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.headers.get('x-agent-token');
  if (!token) return NextResponse.json({ error: 'missing x-agent-token' }, { status: 401 });

  const caller = await agentByToken(token);
  if (!caller || caller.id !== id) {
    return NextResponse.json({ error: 'token does not belong to this agent' }, { status: 403 });
  }

  const agent = await getAgent(id);
  if (!agent) return NextResponse.json({ error: 'no such agent' }, { status: 404 });

  const state = await getState();
  let balance = 0;
  if (state.mint) {
    balance = await tokenBalanceOf(new PublicKey(state.mint), new PublicKey(addressOf(agent)));
  }

  const ledger = await getLedger();
  const spent = spentToday(ledger, agent.id);
  const remaining = Math.max(0, agent.policy.dailyCap - spent);

  return NextResponse.json({
    agent: {
      id: agent.id,
      name: agent.name,
      address: addressOf(agent),
      balance,
      policy: agent.policy,
    },
    spentToday: spent,
    remainingToday: remaining,
    callsLeft: agent.policy.perCallCap > 0 ? Math.floor(remaining / agent.policy.perCallCap) : 0,
    mint: state.mint,
    services: SERVICES.map((service) => ({
      id: service.id,
      name: service.name,
      blurb: service.blurb,
      price: service.price,
    })),
  });
}
