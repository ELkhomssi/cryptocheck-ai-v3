import { NextResponse } from 'next/server'

/** Poll fallback payload — extend with PnL / alerts when wired. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ts: Date.now(),
    topics: [] as string[],
  })
}
