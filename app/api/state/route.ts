import { NextResponse } from 'next/server';
import { agentByToken, agentByViewToken, allAgents, toPublic } from '@/lib/agents';
import { listRuns, mergeSummaries, spentToday, summariesFromLedger } from '@/lib/agent';
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
  const { treasury } = await wallets();

  // Recorded session, for building and reviewing the interface without devnet.
  if (process.env.STIPEND_FIXTURE === '1') {
    const { fixtureLedger, fixtureRun, fixtureSnapshot } = await import('@/lib/fixture');
    const { mergeSummaries, summariesFromLedger } = await import('@/lib/agent');
    const ledger = fixtureLedger();
    const live = [fixtureRun('normal')];
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
      runs: live,
      runSummaries: mergeSummaries(summariesFromLedger(ledger), live),
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

    // Two different keys open a console:
    //   ?token=  the owner's key — full control, and it can spend, so it is theirs alone.
    //   ?view=   a read-only key — safe to share, opens one dashboard, can do nothing else.
    let requested = url.searchParams.get('agent');
    let readOnly = false;
    let scoped = false;

    const view = url.searchParams.get('view');
    const token = url.searchParams.get('token');
    if (view) {
      const viewer = await agentByViewToken(view);
      if (!viewer) return NextResponse.json({ error: 'that shared link is not valid' }, { status: 401 });
      requested = viewer.id;
      readOnly = true;
      scoped = true;
    } else if (token) {
      const owner = await agentByToken(token);
      if (!owner) return NextResponse.json({ error: 'that console link is not valid' }, { status: 401 });
      requested = owner.id;
      scoped = true;
    }

    const snapshot = await liveSnapshot(requested, refresh ? 0 : 1500);
    const agents = await allAgents();
    const demoId = agents.find((agent) => agent.demo)?.id;
    // Someone else's purchases are not this agent's history. Records written
    // before agents were tracked belong to the demo agent and nobody else.
    const ledger = (await getLedger()).filter(
      (entry) =>
        entry.agentId === snapshot.agent.id ||
        (entry.agentId === undefined && snapshot.agent.id === demoId),
    );
    const live = await listRuns(snapshot.agent.id);

    return NextResponse.json({
      ok: true,
      needsFunding: false,
      readOnly,
      snapshot,
      policy: snapshot.policy,
      spentToday: spentToday(ledger, snapshot.agent.id),
      ledger,
      services: SERVICES,
      hostileService: HOSTILE_SERVICE,
      llm: { configured: llmConfigured(), label: llmLabel() },
      runs: live,
      runSummaries: mergeSummaries(summariesFromLedger(ledger), live),
      // A keyed link sees only its own agent. The local console sees them all.
      agents: scoped
        ? readOnly
          ? []
          : [toPublic((await allAgents()).find((agent) => agent.id === snapshot.agent.id)!, snapshot.agent.tokensRaw)]
        : agents.map((agent) =>
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
