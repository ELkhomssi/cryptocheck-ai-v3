import { NextRequest, NextResponse } from 'next/server'
import {
  clearPersistedDna,
  getPersistedDna,
  savePersistedDna,
} from '@/lib/terminal-os/dna-store'
import type { TraderDna } from '@/features/terminal-os/ai-trade-like-me/types'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function validWallet(w: string) {
  return isValidSolanaMint(w) || /^0x[a-fA-F0-9]{40}$/.test(w)
}

/** GET /api/terminal-os/dna?wallet= — load persisted TraderDNA */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!wallet || !validWallet(wallet)) {
    return NextResponse.json({ error: 'Valid wallet required' }, { status: 400 })
  }
  const dna = await getPersistedDna(wallet)
  return NextResponse.json(
    { dna, sampleSize: dna?.sampleSize ?? 0 },
    { headers: { 'cache-control': 'no-store' } },
  )
}

/** POST /api/terminal-os/dna — persist client-trained DNA */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { dna?: TraderDna }
  const dna = body.dna
  if (!dna?.wallet || typeof dna.sampleSize !== 'number' || !validWallet(dna.wallet)) {
    return NextResponse.json({ error: 'Valid dna.wallet + sampleSize required' }, { status: 400 })
  }
  await savePersistedDna(dna)
  return NextResponse.json({ ok: true, sampleSize: dna.sampleSize })
}

/** DELETE /api/terminal-os/dna?wallet= — optional wipe (not called on disconnect by default) */
export async function DELETE(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!wallet || !validWallet(wallet)) {
    return NextResponse.json({ error: 'Valid wallet required' }, { status: 400 })
  }
  await clearPersistedDna(wallet)
  return NextResponse.json({ ok: true })
}
