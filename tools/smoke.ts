/* End-to-end proof for the on-chain primitives. Run: pnpm smoke */
import { createTransferInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { keypairFor, pickAgent } from '../lib/agents';
import { bootstrap, snapshot, tokenBalanceOf } from '../lib/bootstrap';
import { SERVICES } from '../lib/config';
import { confirmSignature, connection } from '../lib/devnet';
import { MEMO_PROGRAM_ID, memoFor } from '../lib/receipt';
import { wallets } from '../lib/wallets';

async function main() {
  console.log('→ bootstrap');
  await bootstrap();

  const agent = await pickAgent();
  const snap = await snapshot(agent.id);
  console.log({
    mint: snap.mint,
    treasury: snap.treasury.address,
    treasurySol: snap.treasury.sol,
    agent: `${snap.agent.name} ${snap.agent.address}`,
    agentTokens: snap.agent.tokensRaw,
    providers: snap.providers.map((provider) => `${provider.id}:${provider.tokensRaw}`),
  });

  const { treasury } = await wallets();
  const agentKeypair = keypairFor(agent);
  const mint = new PublicKey(snap.mint);
  const service = SERVICES[0];
  const providerAddress = snap.providers.find((provider) => provider.id === service.id)?.address;
  if (!providerAddress) throw new Error('no provider address in the snapshot');

  const source = getAssociatedTokenAddressSync(mint, agentKeypair.publicKey, true);
  const destination = getAssociatedTokenAddressSync(mint, new PublicKey(providerAddress), true);

  console.log('→ paying', service.id, service.price);
  const started = Date.now();
  const transaction = new Transaction().add(
    createTransferInstruction(source, destination, agentKeypair.publicKey, service.price),
    {
      keys: [{ pubkey: agentKeypair.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(
        memoFor({ serviceId: service.id, amount: service.price, runId: 'smoke' }),
        'utf8',
      ),
    },
  );
  transaction.feePayer = treasury.publicKey;
  transaction.recentBlockhash = (await connection().getLatestBlockhash('confirmed')).blockhash;

  const signature = await sendAndConfirmTransaction(
    connection(),
    transaction,
    [treasury, agentKeypair],
    { commitment: 'confirmed' },
  );
  const { elapsedMs } = await confirmSignature(signature);
  console.log('  settled', signature, `${elapsedMs}ms`, `wall ${Date.now() - started}ms`);

  const [agentAfter, providerAfter] = await Promise.all([
    tokenBalanceOf(mint, agentKeypair.publicKey),
    tokenBalanceOf(mint, new PublicKey(providerAddress)),
  ]);
  console.log({ agentAfter, providerAfter });

  const after = await snapshot(agent.id);
  console.log('→ snapshot ok', after.providers.map((provider) => `${provider.id}:${provider.tokensRaw}`));
}

main().catch((error) => {
  console.error('SMOKE FAILED:', error);
  process.exitCode = 1;
});
