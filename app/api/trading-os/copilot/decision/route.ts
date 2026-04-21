import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getActiveSaasSubscription } from '@/lib/services/saas-subscription.service'
import { hasAccess, type AccessContext } from '@/lib/access-control'
import { runCopilotDecision } from '@/modules/copilot'
import type { RawCopilotSignals } from '@/lib/data-normalizer'
import { fetchTokenExitIntelSnapshot, type TokenExitIntelSnapshot } from '@/lib/token-exit-intel-server'
import { isSplMintRenounced } from '@/lib/token-exit-intel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function loadAccessContext(userId: string): Promise<AccessContext> {
  const sb = getSupabaseAdmin()
  const { data: p } = await sb.from('profiles').select('tier').eq('id', userId).maybeSingle()
  const saas = await getActiveSaasSubscription(userId)
  return { profileTier: p?.tier ?? null, saasTier: saas?.tier ?? null }
}

function snapshotToRaw(s: TokenExitIntelSnapshot): RawCopilotSignals {
  const f = s.facts
  const liq = Math.max(1, f.liquidityUsd)
  const liquidityVelocity = Math.min(2, f.volume24h / liq)
  const denom = Math.max(1, f.buys24h + f.sells24h)
  const volumeSpike = Math.min(6, f.volume24h / denom)
  return {
    neuralScore: s.neuralScore,
    liquidityVelocity,
    mintRenounced: isSplMintRenounced(f.splMintAuthority),
    freezeActive: !!f.splFreezeAuthority,
    metadataMutable: !!f.metadataUpdateAuthority,
    top1Pct: f.top1Pct,
    volumeSpike,
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await loadAccessContext(user.id)
  if (!hasAccess(ctx, 'copilot')) {
    return NextResponse.json({ error: 'Copilot requires PRO MAX DEEP or ELITE band.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  let raw: RawCopilotSignals | null = null

  if (body?.signals && typeof body.signals === 'object') {
    const s = body.signals as RawCopilotSignals
    raw = {
      neuralScore: Number(s.neuralScore),
      liquidityVelocity: Number(s.liquidityVelocity),
      mintRenounced: !!s.mintRenounced,
      freezeActive: !!s.freezeActive,
      metadataMutable: !!s.metadataMutable,
      top1Pct: Number(s.top1Pct),
      volumeSpike: Number(s.volumeSpike),
    }
  }

  const mint = typeof body?.mint === 'string' ? body.mint.trim() : ''
  if (!raw && mint.length >= 32) {
    const snap = await fetchTokenExitIntelSnapshot(mint)
    if (snap.ok === false) {
      return NextResponse.json({ error: snap.error.message, code: snap.error.code }, { status: 400 })
    }
    raw = snapshotToRaw(snap.data)
  }

  if (!raw || Number.isNaN(raw.neuralScore)) {
    return NextResponse.json({ error: 'Provide { mint } or { signals }' }, { status: 400 })
  }

  const decision = runCopilotDecision(raw)
  return NextResponse.json(decision)
}
