import { NextResponse } from 'next/server';
import { listRuns, spentToday } from '@/lib/agent';
import { bootstrap, FundingRequiredError, liveSnapshot } from '@/lib/bootstrap';
import { HOSTILE_SERVICE, SERVICES } from '@/lib/config';
import { llmConfigured, llmLabel } from '@/lib/llm';
import { getLedger, getState } from '@/lib/store';
import { wallets } from '@/lib/wallets';

export const dynamic = 'force-dynamic';

/** Everything the dashboard needs, in one poll. */
export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get('refresh') === '1';
  const { treasury } = await wallets();

  // Recorded session, for building and reviewing the interface without devnet.
  if (process.env.STIPEND_FIXTURE === '1') {
    const { fixtureLedger, fixtureRun, fixtureSnapshot } = await import('@/lib/fixture');
    const ledger = fixtureLedger();
    return NextResponse.json({
      ok: true,
      needsFunding: false,
      fixture: true,
      snapshot: fixtureSnapshot(),
      policy: fixtureSnapshot().policy,
      spentToday: ledger.filter((entry) => entry.decision === 'settled').reduce((s, e) => s + e.price, 0),
      ledger,
      services: SERVICES,
      hostileService: HOSTILE_SERVICE,
      llm: { configured: llmConfigured(), label: llmLabel() },
      runs: [fixtureRun('normal')],
    });
  }

  try {
    const state = await getState();
    let snapshot = state.mint ? await liveSnapshot(refresh ? 0 : 1500) : await bootstrap();
    if (!snapshot.mint) snapshot = await bootstrap();

    const ledger = await getLedger();
    return NextResponse.json({
      ok: true,
      needsFunding: false,
      snapshot,
      policy: snapshot.policy,
      spentToday: spentToday(ledger),
      ledger: ledger.slice(0, 60),
      services: SERVICES,
      hostileService: HOSTILE_SERVICE,
      llm: { configured: llmConfigured(), label: llmLabel() },
      runs: listRuns(),
    });
  } catch (error) {
    if (error instanceof FundingRequiredError) {
      return NextResponse.json({
        ok: false,
        needsFunding: true,
        treasuryAddress: error.address,
        solBalance: error.solBalance,
        faucetUrl: 'https://faucet.solana.com',
        message:
          'The devnet faucet is closed, so the treasury needs one transfer before it can pay fees.',
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, needsFunding: false, treasuryAddress: treasury.publicKey.toBase58(), error: message },
      { status: 500 },
    );
  }
}
