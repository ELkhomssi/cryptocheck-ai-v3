import { NextRequest, NextResponse } from 'next/server'
import { getWeb4NeuralSafety, WEB4_DEFAULT_MINT } from '@/lib/web4-terminal/market-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get('mint')?.trim() || WEB4_DEFAULT_MINT
  if (mint.length < 32) {
    return NextResponse.json({ error: 'Valid mint required' }, { status: 400 })
  }
  try {
    const safety = await getWeb4NeuralSafety(mint)
    return NextResponse.json(safety)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Safety scan failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
