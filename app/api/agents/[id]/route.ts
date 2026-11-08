import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAgent, setPolicy, toPublic } from '@/lib/agents';
import { invalidateSnapshot } from '@/lib/bootstrap';

export const dynamic = 'force-dynamic';

const schema = z.object({
  perCallCap: z.number().int().min(1_000).max(1_000_000_000).optional(),
  dailyCap: z.number().int().min(10_000).max(1_000_000_000).optional(),
  allowlist: z.array(z.string()).max(10).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) return NextResponse.json({ error: 'no such agent' }, { status: 404 });
  return NextResponse.json({ agent: toPublic(agent) });
}

/** Policy edits apply to the next purchase, never to one already signed. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid policy' }, { status: 400 });

  const policy = await setPolicy(id, parsed.data);
  if (!policy) return NextResponse.json({ error: 'no such agent' }, { status: 404 });

  invalidateSnapshot();
  return NextResponse.json({ policy });
}
