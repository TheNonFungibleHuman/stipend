import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listRuns, startRun } from '@/lib/agent';

export const dynamic = 'force-dynamic';

const schema = z.object({
  goal: z.string().min(3).max(400),
  mode: z.enum(['normal', 'rogue']).optional(),
  agentId: z.string().min(1).max(64).optional(),
});

export async function GET(request: Request) {
  const agentId = new URL(request.url).searchParams.get('agent') ?? undefined;
  return NextResponse.json({ runs: listRuns(agentId) });
}

/** Starts a run. Returns immediately; the client polls /api/run/[id]. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'a goal between 3 and 400 characters is required' },
      { status: 400 },
    );
  }

  if (process.env.STIPEND_FIXTURE === '1') {
    const { fixtureRun } = await import('@/lib/fixture');
    return NextResponse.json({ run: fixtureRun(parsed.data.mode ?? 'normal') });
  }

  const origin = new URL(request.url).origin;
  try {
    const run = await startRun({
      agentId: parsed.data.agentId,
      goal: parsed.data.goal,
      mode: parsed.data.mode,
      baseUrl: origin,
    });
    return NextResponse.json({ run });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
