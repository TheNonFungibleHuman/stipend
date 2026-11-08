import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listRuns, startRun } from '@/lib/agent';
import { canMutate } from '@/lib/agents';

export const dynamic = 'force-dynamic';
// The pipeline settles three payments and makes two model calls in one request.
export const maxDuration = 60;

const schema = z.object({
  goal: z.string().min(3).max(400),
  mode: z.enum(['normal', 'rogue']).optional(),
  agentId: z.string().min(1).max(64).optional(),
});

export async function GET(request: Request) {
  const agentId = new URL(request.url).searchParams.get('agent') ?? undefined;
  return NextResponse.json({ runs: await listRuns(agentId) });
}

/**
 * Starts a run and streams its progress as newline-delimited JSON.
 *
 * The work happens inside this request — a serverless host kills background work
 * when the response ends — so the response *is* the progress channel. Every step
 * arrives the moment it changes, which is what makes a ten-second run feel like
 * something happening rather than a spinner.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'a goal between 3 and 400 characters is required' },
      { status: 400 },
    );
  }

  if (parsed.data.agentId && !(await canMutate(request, parsed.data.agentId))) {
    return NextResponse.json({ error: 'that key does not belong to this agent' }, { status: 403 });
  }

  const origin = new URL(request.url).origin;
  const fixture = process.env.STIPEND_FIXTURE === '1';
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        } catch {
          /* the client went away; stop writing */
        }
      };

      try {
        if (fixture) {
          const { fixtureRun } = await import('@/lib/fixture');
          const run = fixtureRun(parsed.data.mode ?? 'normal');
          send({ type: 'run', run });
          send({ type: 'done', run });
          return;
        }

        const run = await startRun(
          {
            agentId: parsed.data.agentId,
            goal: parsed.data.goal,
            mode: parsed.data.mode,
            baseUrl: origin,
          },
          (snapshot) => send({ type: 'run', run: snapshot }),
        );
        send({ type: 'done', run });
      } catch (error) {
        send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
