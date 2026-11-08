import { NextResponse } from 'next/server';
import { z } from 'zod';
import { invalidateSnapshot } from '@/lib/bootstrap';
import { getState, patchState } from '@/lib/store';

export const dynamic = 'force-dynamic';

const schema = z.object({
  perCallCap: z.number().int().min(0).max(1_000_000_000).optional(),
  dailyCap: z.number().int().min(0).max(1_000_000_000).optional(),
  allowlist: z.array(z.string()).max(10).optional(),
});

export async function GET() {
  const state = await getState();
  return NextResponse.json({ policy: state.policy });
}

/**
 * Live policy edits. Lowering the cap mid-demo and watching the next call get
 * refused is the clearest possible statement that the limit is real.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid policy' }, { status: 400 });
  }
  const state = await getState();
  const next = {
    perCallCap: parsed.data.perCallCap ?? state.policy.perCallCap,
    dailyCap: parsed.data.dailyCap ?? state.policy.dailyCap,
    allowlist: parsed.data.allowlist ?? state.policy.allowlist,
  };
  await patchState({ policy: next });
  invalidateSnapshot();
  return NextResponse.json({ policy: next });
}
