/**
 * GET|POST /api/terminal-os/rotation
 * Capital rotation — advise-only proposals by default.
 *
 * GET  ?wallet= — threshold, proposal, events, aggregate
 * POST { wallet, action: 'evaluate'|'approve'|'reject'|'set_threshold', thresholdPct?, permissionMode? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { isValidSolanaWallet } from '@/lib/portfolio-desk/validate'
import {
  computeRotationAggregate,
  getRotationProposal,
  getRotationThreshold,
  listRotationEvents,
  saveRotationThreshold,
  DEFAULT_LOSS_THRESHOLD_PCT,
  type RotationPermissionMode,
} from '@/lib/terminal-os/rotation-store'
import {
  confirmRotationProposal,
  recordRotationEntryFill,
  resolveLossThreshold,
  runCapitalRotationTick,
} from '@/lib/terminal-os/rotation-workflow'
import { getPersistedDna } from '@/lib/terminal-os/dna-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!wallet || !isValidSolanaWallet(wallet)) {
    return NextResponse.json({ error: 'Valid Solana wallet required' }, { status: 400 })
  }

  const dna = await getPersistedDna(wallet).catch(() => null)
  const threshold =
    (await getRotationThreshold(wallet)) ??
    (await resolveLossThreshold(wallet, dna))
  const proposal = await getRotationProposal(wallet)
  const events = await listRotationEvents(wallet, 24)
  const aggregate = computeRotationAggregate(events)

  return NextResponse.json(
    {
      threshold,
      proposal,
      events,
      aggregate,
      defaultThresholdPct: DEFAULT_LOSS_THRESHOLD_PCT,
      permissionDefault: 'advise_only' as const,
      honestyNote:
        'The AI exits a weakening position before it becomes a big loss and redeploys into current strength. Exit legs may still be real losses versus entry — never zero-loss.',
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    wallet?: string
    action?: 'evaluate' | 'approve' | 'reject' | 'set_threshold' | 'record_entry_fill'
    thresholdPct?: number
    permissionMode?: RotationPermissionMode
    entryMint?: string
  }
  const wallet = body.wallet?.trim() ?? ''
  if (!wallet || !isValidSolanaWallet(wallet)) {
    return NextResponse.json({ error: 'Valid Solana wallet required' }, { status: 400 })
  }

  const action = body.action ?? 'evaluate'

  if (action === 'set_threshold') {
    if (typeof body.thresholdPct !== 'number' || !Number.isFinite(body.thresholdPct)) {
      return NextResponse.json({ error: 'thresholdPct required' }, { status: 400 })
    }
    // Autonomous system must never change this — only explicit user POST
    const dna = await getPersistedDna(wallet).catch(() => null)
    const threshold = await resolveLossThreshold(wallet, dna, body.thresholdPct)
    return NextResponse.json({ ok: true, threshold })
  }

  if (action === 'approve' || action === 'reject') {
    const result = await confirmRotationProposal(wallet, action)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    const events = await listRotationEvents(wallet, 24)
    return NextResponse.json({
      ok: true,
      proposal: result.proposal,
      event: result.event ?? null,
      aggregate: computeRotationAggregate(events),
      nextStep:
        action === 'approve'
          ? 'Execute EXIT then BUY via Intelligence Swap — wallet signature required. Advise-only never auto-sells.'
          : 'Proposal rejected — no execution.',
    })
  }

  if (action === 'record_entry_fill') {
    const entryMint = body.entryMint?.trim() ?? ''
    if (!entryMint) {
      return NextResponse.json({ error: 'entryMint required' }, { status: 400 })
    }
    const result = await recordRotationEntryFill({ wallet, entryMint })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    const events = await listRotationEvents(wallet, 24)
    return NextResponse.json({
      ok: true,
      event: result.event,
      aggregate: computeRotationAggregate(events),
    })
  }

  // evaluate — never elevates past advise_only unless user explicitly passed a mode,
  // and even then this endpoint only creates a proposal (no broadcast).
  const mode: RotationPermissionMode =
    body.permissionMode === 'execute_with_confirmation' || body.permissionMode === 'bounded_autonomy'
      ? body.permissionMode
      : 'advise_only'

  const tick = await runCapitalRotationTick({
    wallet,
    permissionMode: mode,
    userThresholdPct: typeof body.thresholdPct === 'number' ? body.thresholdPct : null,
  })

  return NextResponse.json({
    ok: true,
    ...tick,
  })
}
