import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { canonicalScan } from '@/lib/sentinel/canonical-scan'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: { mint: string } }
) {
  const requestId = randomUUID()
  try {
    const mint = String(params.mint ?? '').trim()
    console.log('[api/v1/sentinel/canonical-scan] start', { requestId, mintLen: mint.length })
    if (mint.length < 32) {
      return NextResponse.json({ error: 'Valid Solana mint required' }, { status: 400 })
    }
    const result = await canonicalScan(mint)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Canonical scan failed'
    console.error('[api/v1/sentinel/canonical-scan] fail', { requestId, message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
