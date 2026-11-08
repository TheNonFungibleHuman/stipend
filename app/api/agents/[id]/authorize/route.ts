import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { agentByToken, keypairFor } from '@/lib/agents';
import { spentToday } from '@/lib/agent';
import { tokenBalanceOf } from '@/lib/bootstrap';
import { serviceById } from '@/lib/config';
import { settle } from '@/lib/pay';
import { evaluate } from '@/lib/policy';
import { appendLedger, getLedger, getState } from '@/lib/store';
import { wallets } from '@/lib/wallets';

export const dynamic = 'force-dynamic';

const schema = z.object({
  serviceId: z.string().min(1).max(64),
  runId: z.string().max(64).optional(),
  query: z.string().max(400).optional(),
});

/**
 * The wallet service. A caller presents its agent token, names a service, and
 * this endpoint does the only thing an agent is not allowed to do for itself:
 * sign a transfer that the policy has already approved.
 *
 * If the policy says no, no signature is produced and the caller gets the
 * reason. That refusal is the product.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = request.headers.get('x-agent-token');
  if (!token) return NextResponse.json({ error: 'missing x-agent-token' }, { status: 401 });

  const caller = await agentByToken(token);
  if (!caller || caller.id !== id) {
    return NextResponse.json({ error: 'token does not belong to this agent' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
  }

  const definition = serviceById(parsed.data.serviceId);
  if (!definition) return NextResponse.json({ error: 'no such service' }, { status: 404 });

  const state = await getState();
  if (!state.mint) return NextResponse.json({ error: 'devnet is not ready' }, { status: 503 });

  const { treasury, providers } = await wallets();
  const provider = providers.get(definition.id);
  if (!provider) return NextResponse.json({ error: 'vendor has no wallet' }, { status: 503 });

  const mint = new PublicKey(state.mint);
  const agentKeypair = keypairFor(caller);
  const [balance, ledger] = await Promise.all([
    tokenBalanceOf(mint, agentKeypair.publicKey),
    getLedger(),
  ]);

  const decision = evaluate({
    policy: caller.policy,
    serviceId: definition.id,
    price: definition.price,
    spentToday: spentToday(ledger, caller.id),
    agentBalance: balance,
  });

  if (!decision.allowed) {
    await appendLedger({
      id: `${caller.id}-${Date.now()}`,
      runId: parsed.data.runId ?? 'external',
      agentId: caller.id,
      at: new Date().toISOString(),
      serviceId: definition.id,
      serviceName: definition.name,
      price: definition.price,
      decision: 'refused',
      reason: decision.message,
      agentBalanceAfter: balance,
    });
    return NextResponse.json(
      { error: 'refused by policy', code: decision.code, reason: decision.message },
      { status: 403 },
    );
  }

  try {
    const runId = parsed.data.runId ?? 'external';
    const { signature, settleMs } = await settle({
      serviceId: definition.id,
      price: definition.price,
      runId,
      agent: agentKeypair,
      treasury,
      mint,
      payee: provider.publicKey,
    });

    const header = Buffer.from(
      JSON.stringify({
        v: 1,
        serviceId: definition.id,
        signature,
        amount: definition.price,
        runId,
      }),
      'utf8',
    ).toString('base64');

    return NextResponse.json({
      header,
      signature,
      settleMs,
      serviceId: definition.id,
      price: definition.price,
      agentBalanceAfter: balance - definition.price,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'settlement failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
