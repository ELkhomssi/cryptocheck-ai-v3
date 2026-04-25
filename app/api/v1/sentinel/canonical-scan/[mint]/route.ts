import { NextResponse } from 'next/server'
import { canonicalScan } from '@/lib/sentinel/canonical-scan'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: { mint: string } }
) {
  try {
    const mint = String(params.mint ?? '').trim()
    if (mint.length < 32) {
      return NextResponse.json({ error: 'Valid Solana mint required' }, { status: 400 })
    }
    const result = await canonicalScan(mint)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Canonical scan failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
