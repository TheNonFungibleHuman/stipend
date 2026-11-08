import { NextResponse } from 'next/server';
import { allAgents, toPublic } from '@/lib/agents';
import { listRuns, spentToday } from '@/lib/agent';
import { bootstrap, FundingRequiredError, liveSnapshot } from '@/lib/bootstrap';
import { HOSTILE_SERVICE, SERVICES } from '@/lib/config';
import { llmConfigured, llmLabel } from '@/lib/llm';
import { getLedger } from '@/lib/store';
import { wallets } from '@/lib/wallets';

export const dynamic = 'force-dynamic';

/** Everything the console needs for one agent, in one poll. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get('refresh') === '1';
  const agentId = url.searchParams.get('agent');
  const { treasury } = await wallets();

  // Recorded session, for building and reviewing the interface without devnet.
  if (process.env.STIPEND_FIXTURE === '1') {
    const { fixtureLedger, fixtureRun, fixtureSnapshot } = await import('@/lib/fixture');
    const ledger = fixtureLedger();
    const snapshot = fixtureSnapshot();
    return NextResponse.json({
      ok: true,
      needsFunding: false,
      fixture: true,
      snapshot,
      policy: snapshot.policy,
      spentToday: ledger
        .filter((entry) => entry.decision === 'settled')
        .reduce((sum, entry) => sum + entry.price, 0),
      ledger,
      services: SERVICES,
      hostileService: HOSTILE_SERVICE,
      llm: { configured: llmConfigured(), label: llmLabel() },
      runs: [fixtureRun('normal')],
      agents: [
        {
          id: snapshot.agent.id,
          name: snapshot.agent.name,
          address: snapshot.agent.address,
          token: 'stp_demo_token_do_not_use',
          policy: snapshot.policy,
          createdAt: new Date(Date.now() - 86_400_000).toISOString(),
          demo: true,
          tokensRaw: snapshot.agent.tokensRaw,
        },
      ],
      activeAgentId: snapshot.agent.id,
    });
  }

  try {
    await bootstrap();
    const snapshot = await liveSnapshot(agentId, refresh ? 0 : 1500);
    const ledger = (await getLedger()).filter(
      (entry) => entry.agentId === snapshot.agent.id || entry.agentId === undefined,
    );
    const agents = await allAgents();

    return NextResponse.json({
      ok: true,
      needsFunding: false,
      snapshot,
      policy: snapshot.policy,
      spentToday: spentToday(ledger, snapshot.agent.id),
      ledger,
      services: SERVICES,
      hostileService: HOSTILE_SERVICE,
      llm: { configured: llmConfigured(), label: llmLabel() },
      runs: listRuns(snapshot.agent.id),
      agents: agents.map((agent) =>
        toPublic(agent, agent.id === snapshot.agent.id ? snapshot.agent.tokensRaw : undefined),
      ),
      activeAgentId: snapshot.agent.id,
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
