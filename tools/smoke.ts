/* Smoke test for the on-chain primitives. Run: pnpm exec tsx tools/smoke.ts */
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { bootstrap, snapshot, tokenBalanceOf } from '../lib/bootstrap';
import { SERVICES } from '../lib/config';
import { confirmSignature, connection } from '../lib/devnet';
import { wallets } from '../lib/wallets';
import { MEMO_PROGRAM_ID } from '../lib/receipt';

async function main() {
  console.log('→ bootstrap');
  const snap = await bootstrap();
  console.log({
    mint: snap.mint,
    treasury: snap.treasury.address,
    treasurySol: snap.treasury.sol,
    agent: snap.agent.address,
    agentTokens: snap.agent.tokensRaw,
    providers: snap.providers.map((p) => `${p.id}:${p.tokensRaw}`),
  });

  const { treasury, agent, providers } = await wallets();
  const mint = new PublicKey(snap.mint);
  const service = SERVICES[0];
  const provider = providers.get(service.id)!;

  const source = getAssociatedTokenAddressSync(mint, agent.publicKey, true);
  const destination = getAssociatedTokenAddressSync(mint, provider.publicKey, true);

  console.log('→ paying', service.id, service.price);
  const before = Date.now();
  const transaction = new Transaction().add(
    createTransferInstruction(source, destination, agent.publicKey, service.price),
    // Memo receipt, the same shape the app writes on every settlement.
    {
      keys: [{ pubkey: agent.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(`stipend:v1:svc=${service.id}:amt=${service.price}`, 'utf8'),
    },
  );
  transaction.feePayer = treasury.publicKey;
  transaction.recentBlockhash = (await connection().getLatestBlockhash('confirmed')).blockhash;

  const signature = await sendAndConfirmTransaction(connection(), transaction, [treasury, agent], {
    commitment: 'confirmed',
  });
  const { elapsedMs } = await confirmSignature(signature);
  console.log('  settled', signature, `${elapsedMs}ms`, `wall ${Date.now() - before}ms`);

  const [agentAfter, providerAfter] = await Promise.all([
    tokenBalanceOf(mint, agent.publicKey),
    tokenBalanceOf(mint, provider.publicKey),
  ]);
  console.log({ agentAfter, providerAfter, delta: providerAfter - 0 });

  const after = await snapshot();
  console.log('→ snapshot ok', after.providers.map((p) => `${p.id}:${p.tokensRaw}`));
}

main().catch((error) => {
  console.error('SMOKE FAILED:', error);
  process.exitCode = 1;
});
