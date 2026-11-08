import { NextResponse } from 'next/server';
import { PAYMENT_HEADER, serviceById } from '@/lib/config';
import type { MarketIntel } from '@/lib/services';
import { runService } from '@/lib/services';
import { getState } from '@/lib/store';
import { verifyPayment } from '@/lib/verify';
import { wallets } from '@/lib/wallets';

export const dynamic = 'force-dynamic';

interface PaymentProof {
  v: number;
  serviceId: string;
  signature: string;
  amount: number;
  runId: string;
}

/**
 * The seller side of the protocol. Ask without proof and you get a 402 that
 * states the price and the payee. Ask with proof and the seller checks devnet
 * itself before doing any work — no accounts, no API keys, no billing table.
 */
export async function POST(request: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const definition = serviceById(serviceId);
  if (!definition) {
    return NextResponse.json({ error: `no such service: ${serviceId}` }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    query?: string;
    runId?: string;
    context?: MarketIntel | null;
  };

  const { providers } = await wallets();
  const provider = providers.get(serviceId);
  const state = await getState();
  if (!provider || !state.mint) {
    return NextResponse.json({ error: 'service is not ready on devnet yet' }, { status: 503 });
  }

  const accepts = {
    scheme: 'exact' as const,
    network: 'solana:devnet',
    serviceId: definition.id,
    price: definition.price,
    payee: provider.publicKey.toBase58(),
    mint: state.mint,
  };

  const header = request.headers.get(PAYMENT_HEADER);
  const challenge = (reason: string) =>
    NextResponse.json(
      { error: 'payment required', reason, accepts },
      { status: 402, headers: { 'x-payment-required': 'exact', 'cache-control': 'no-store' } },
    );

  if (!header) return challenge('no payment attached');

  let proof: PaymentProof;
  try {
    proof = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as PaymentProof;
  } catch {
    return challenge('payment header is not valid base64 json');
  }

  if (proof.serviceId !== serviceId) return challenge('payment is for a different service');

  const verdict = await verifyPayment({
    signature: proof.signature ?? '',
    mint: state.mint,
    payee: accepts.payee,
    amount: definition.price,
  });
  if (!verdict.ok) return challenge(verdict.reason);

  const work = await runService(definition.id, {
    query: body.query ?? '',
    intel: body.context ?? undefined,
  });

  return NextResponse.json(
    {
      serviceId: definition.id,
      engine: work.engine,
      model: work.model,
      computeMs: work.computeMs,
      output: work.output,
      receipt: {
        signature: proof.signature,
        slot: verdict.slot,
        settled: verdict.settledAmount,
        runId: proof.runId,
      },
    },
    {
      headers: {
        'x-payment-response': Buffer.from(
          JSON.stringify({ settled: true, signature: proof.signature, slot: verdict.slot }),
        ).toString('base64'),
      },
    },
  );
}
