import { createTransferInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { PAYMENT_HEADER, type Policy } from './config';
import { confirmSignature, connection, withRetry } from './devnet';
import { evaluate } from './policy';
import { MEMO_PROGRAM_ID, memoFor } from './receipt';

export interface Quote {
  scheme: 'exact';
  network: string;
  serviceId: string;
  price: number;
  payee: string;
  mint: string;
}

export type PaidCallResult =
  | {
      status: 'settled';
      quote: Quote;
      data: unknown;
      signature: string;
      settleMs: number;
      verifyMs: number;
    }
  | { status: 'refused'; quote: Quote; code: string; reason: string }
  | { status: 'error'; reason: string; quote?: Quote };

export interface PaidCallInput {
  baseUrl: string;
  serviceId: string;
  query: string;
  runId: string;
  /** Output of the previous step, so the chain is a pipeline and not three parallel calls. */
  context?: unknown;
  /** The agent's own token, presented so the vendor can attribute the call. */
  agentToken?: string;
  policy: Policy;
  spentToday: number;
  agentBalance: number;
  agent: Keypair;
  treasury: Keypair;
  mint: PublicKey;
}

const paymentHeader = (payload: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify({ v: 1, ...payload }), 'utf8').toString('base64');

function paidUrl(input: PaidCallInput): URL {
  return new URL(`/api/paid/${input.serviceId}`, input.baseUrl);
}

function bodyFor(input: PaidCallInput): string {
  return JSON.stringify({ query: input.query, runId: input.runId, context: input.context ?? null });
}

function headersFor(input: PaidCallInput, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(input.agentToken ? { 'x-agent-token': input.agentToken } : {}),
    ...extra,
  };
}

/** Step one of the dance: ask, and read the price off a real 402. */
async function requestQuote(input: PaidCallInput): Promise<{ response: Response; quote?: Quote }> {
  const response = await fetch(paidUrl(input), {
    method: 'POST',
    cache: 'no-store',
    headers: headersFor(input),
    body: bodyFor(input),
  });
  if (response.status !== 402) return { response };
  const body = (await response.json()) as { accepts?: Quote };
  return { response, quote: body.accepts };
}

/**
 * Step two: sign. The policy check sits immediately before this call, so a
 * refusal here means the transaction was never built at all.
 *
 * The treasury sponsors the fee and the agent only ever holds the stablecoin,
 * which is what makes a per-2-cent payment economic.
 */
export async function settle(input: {
  serviceId: string;
  price: number;
  runId: string;
  agent: Keypair;
  treasury: Keypair;
  mint: PublicKey;
  payee: PublicKey;
}): Promise<{ signature: string; settleMs: number }> {
  const { agent, treasury, mint, payee } = input;
  const source = getAssociatedTokenAddressSync(mint, agent.publicKey, true);
  const destination = getAssociatedTokenAddressSync(mint, payee, true);

  const transaction = new Transaction().add(
    createTransferInstruction(source, destination, agent.publicKey, input.price),
    {
      keys: [{ pubkey: agent.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(
        memoFor({ serviceId: input.serviceId, amount: input.price, runId: input.runId }),
        'utf8',
      ),
    },
  );

  transaction.feePayer = treasury.publicKey;
  const { blockhash, lastValidBlockHeight } = await withRetry('getLatestBlockhash', () =>
    connection().getLatestBlockhash('confirmed'),
  );
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;

  const started = Date.now();
  const signature = await withRetry('sendAndConfirmTransaction', () =>
    sendAndConfirmTransaction(connection(), transaction, [treasury, agent], {
      commitment: 'confirmed',
      skipPreflight: false,
    }),
  );
  const confirmation = await confirmSignature(signature);
  return { signature, settleMs: confirmation.elapsedMs || Date.now() - started };
}

/**
 * The whole loop: quote → policy → settle → retry with proof of payment.
 * Returns a result the ledger can store without further interpretation.
 */
export async function paidCall(input: PaidCallInput): Promise<PaidCallResult> {
  const { response, quote } = await requestQuote(input);
  if (!quote) {
    return { status: 'error', reason: `expected a 402 from ${input.serviceId}, got ${response.status}` };
  }

  const decision = evaluate({
    policy: input.policy,
    serviceId: quote.serviceId,
    price: quote.price,
    spentToday: input.spentToday,
    agentBalance: input.agentBalance,
  });
  if (!decision.allowed) {
    return { status: 'refused', quote, code: decision.code, reason: decision.message };
  }

  const { signature, settleMs } = await settle({
    serviceId: quote.serviceId,
    price: quote.price,
    runId: input.runId,
    agent: input.agent,
    treasury: input.treasury,
    mint: input.mint,
    payee: new PublicKey(quote.payee),
  });

  const paidUrlWithProof = paidUrl(input);
  const verifyStarted = Date.now();
  const paid = await fetch(paidUrlWithProof, {
    method: 'POST',
    cache: 'no-store',
    headers: headersFor(input, {
      [PAYMENT_HEADER]: paymentHeader({
        serviceId: quote.serviceId,
        signature,
        amount: quote.price,
        runId: input.runId,
      }),
    }),
    body: bodyFor(input),
  });

  if (!paid.ok) {
    const detail = await paid.text();
    return { status: 'error', quote, reason: `service rejected payment: ${paid.status} ${detail.slice(0, 160)}` };
  }

  return {
    status: 'settled',
    quote,
    data: await paid.json(),
    signature,
    settleMs,
    verifyMs: Date.now() - verifyStarted,
  };
}
