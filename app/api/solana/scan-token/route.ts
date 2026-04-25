import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { scanToken } from '@/lib/helius-server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const requestId = randomUUID()
  try {
    const body = await req.json().catch(() => ({})) as { mint?: string }
    const mint = typeof body.mint === 'string' ? body.mint.trim() : ''
    console.log('[api/solana/scan-token] start', { requestId, mintLen: mint.length })
    if (!mint || mint.length < 32) {
      return NextResponse.json({ error: 'Valid mint address required' }, { status: 400 })
    }
    const data = await scanToken(mint)
    return NextResponse.json(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Scan failed'
    console.error('[api/solana/scan-token] fail', { requestId, message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
