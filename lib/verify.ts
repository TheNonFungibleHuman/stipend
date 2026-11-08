import { PublicKey } from '@solana/web3.js';
import { connection, withRetry } from './devnet';

/**
 * Server-side settlement verification.
 *
 * We do not trust the client's claim that it paid. We read the transaction off
 * devnet and check that the payee's token account actually gained at least the
 * quoted amount. Settlement *is* the authorisation — that is the whole reason
 * this works without accounts, API keys or a billing database.
 */
export type VerifyResult =
  | { ok: true; slot: number; settledAmount: number }
  | { ok: false; reason: string };

const seenSignatures = new Set<string>();

export interface VerifyInput {
  signature: string;
  mint: string;
  payee: string;
  amount: number;
}

export async function verifyPayment({
  signature,
  mint,
  payee,
  amount,
}: VerifyInput): Promise<VerifyResult> {
  if (seenSignatures.has(signature)) {
    return { ok: false, reason: 'this payment was already used for a call' };
  }

  // A freshly confirmed transaction can take a moment to appear via
  // getTransaction; give it a couple of short retries before refusing.
  let transaction = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    transaction = await withRetry('getTransaction', () =>
      connection().getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      }),
    );
    if (transaction) break;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  if (!transaction) return { ok: false, reason: 'payment not found on devnet yet' };
  if (transaction.meta?.err) return { ok: false, reason: 'payment transaction failed on chain' };

  const pre = transaction.meta?.preTokenBalances ?? [];
  const post = transaction.meta?.postTokenBalances ?? [];

  // Sum the payee's holdings of this mint before and after the transaction.
  const totalFor = (balances: typeof pre): number =>
    balances
      .filter((balance) => balance.owner === payee && balance.mint === mint)
      .reduce((sum, balance) => sum + Number(balance.uiTokenAmount.amount), 0);

  const delta = totalFor(post) - totalFor(pre);
  if (delta < amount) {
    return {
      ok: false,
      reason: `payee received ${delta} but the quote was ${amount}`,
    };
  }

  seenSignatures.add(signature);
  return { ok: true, slot: transaction.slot, settledAmount: delta };
}

export function resetSignatureCache(): void {
  seenSignatures.clear();
}
