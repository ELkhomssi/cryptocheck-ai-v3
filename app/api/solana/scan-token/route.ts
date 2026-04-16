import { NextRequest, NextResponse } from 'next/server'
import { scanToken } from '@/lib/helius-server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { mint?: string }
    const mint = typeof body.mint === 'string' ? body.mint.trim() : ''
    if (!mint || mint.length < 32) {
      return NextResponse.json({ error: 'Valid mint address required' }, { status: 400 })
    }
    const data = await scanToken(mint)
    return NextResponse.json(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Scan failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
