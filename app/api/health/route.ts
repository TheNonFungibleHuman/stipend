import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Answers instantly and touches no chain, so "is the site down?" has a cheap
 * answer that does not depend on a devnet RPC call being quick.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'stipend',
      at: new Date().toISOString(),
      model: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
      store: Boolean(process.env.KV_REST_API_URL?.trim()),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
