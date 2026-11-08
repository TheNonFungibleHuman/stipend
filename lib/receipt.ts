import { PublicKey } from '@solana/web3.js';

/**
 * Receipts ride along with the payment as a Memo instruction. No program of our
 * own, no extra account rent, and the receipt is still permanently readable
 * from the transaction on any explorer.
 *
 * This is the v4 memo program (verified executable on devnet), not the older
 * `MemoSq4g...` address, which is not deployed there.
 */
export const MEMO_PROGRAM_ID = new PublicKey('Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH');

export interface ReceiptInfo {
  serviceId: string;
  amount: number;
  runId: string;
}

export function memoFor({ serviceId, amount, runId }: ReceiptInfo): string {
  return `stipend:v1:svc=${serviceId}:amt=${amount}:run=${runId}`;
}

export function parseMemo(data: string): Partial<ReceiptInfo> {
  if (!data.startsWith('stipend:v1:')) return {};
  const out: Partial<ReceiptInfo> = {};
  for (const part of data.slice('stipend:v1:'.length).split(':')) {
    const [key, value] = part.split('=');
    if (key === 'svc') out.serviceId = value;
    if (key === 'amt') out.amount = Number(value);
    if (key === 'run') out.runId = value;
  }
  return out;
}

export function explorerTx(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddress(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
