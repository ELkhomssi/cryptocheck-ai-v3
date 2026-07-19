import { NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'
import { buildLaunchTransactions } from '@/lib/launch/build-launch'
import { getRpcUrl } from '@/lib/launch/config'
import { isLaunchModePaused } from '@/lib/launch/control'
import { resolveCurveParams } from '@/lib/launch/curve-params'
import { assessCreatorReputation } from '@/lib/launch/creator-reputation'
import { isLaunchModeEnabled } from '@/lib/launch/feature-flag'
import { assertPlatformConfigValid } from '@/lib/launch/guards'
import { recordPrepareAttempt } from '@/lib/launch/ops-monitor'
import { screenLaunchMetadata } from '@/lib/launch/screen-metadata'
import { LAUNCH_COMPLIANCE, type LaunchPrepareInput } from '@/lib/launch/types'
import { enforceRateLimit } from '@/lib/services/rate-limit.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/launch/prepare
 * Authoritative scanner-gated launch builder.
 * Client NEVER receives a tx unless metadata, creator reputation, and curve bounds pass.
 * Non-custodial: returns unsigned/mint-partially-signed txs only — user wallet co-signs.
 */
export async function POST(req: Request) {
  await assertPlatformConfigValid(new Connection(getRpcUrl(), 'confirmed'))

  // Kill-switch first — pause new creations without taking Scan/Swap/Sniper down.
  if (await isLaunchModePaused()) {
    return NextResponse.json(
      {
        error: 'Launch mode is paused',
        blocked: true,
        reasons: [
          'LAUNCH_MODE_PAUSED is active — new token creates are rejected. Scan/Swap/Sniper are unaffected.',
        ],
        compliance: LAUNCH_COMPLIANCE,
      },
      { status: 503 },
    )
  }

  if (!isLaunchModeEnabled()) {
    return NextResponse.json(
      {
        error: 'Launch mode is coming soon',
        blocked: true,
        reasons: [
          'Token create is disabled until Launch mode is explicitly enabled for this cluster.',
        ],
        compliance: LAUNCH_COMPLIANCE,
      },
      { status: 503 },
    )
  }

  const body = (await req.json().catch(() => ({}))) as Partial<LaunchPrepareInput>
  const creatorWallet = String(body.creatorWallet ?? '').trim()

  // Rate-limit prepare by creator wallet (or IP fallback).
  const rlKey = creatorWallet || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon'
  let rl: Awaited<ReturnType<typeof enforceRateLimit>>
  try {
    rl = await enforceRateLimit(`launch:prepare:${rlKey}`, 'free')
  } catch {
    // Local Upstash REST shim down — fail open for prepare (still gated by scanner + platformPda).
    rl = { ok: true, limit: 0, remaining: 0, reset: 0 }
  }
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', blocked: true, reasons: ['Too many launch prepare attempts'] },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
          'X-RateLimit-Reset': String(rl.reset),
        },
      },
    )
  }

  void recordPrepareAttempt(creatorWallet || 'anon')

  const reasons: string[] = []

  try {
    new PublicKey(creatorWallet)
  } catch {
    reasons.push('Valid creatorWallet (Solana pubkey) required')
  }

  const name = String(body.name ?? '').trim()
  const ticker = String(body.ticker ?? '').trim()
  const description = String(body.description ?? '').trim()
  const imageUrl = String(body.imageUrl ?? '').trim()

  reasons.push(
    ...screenLaunchMetadata({ name, ticker, description, imageUrl }),
  )

  if (creatorWallet) {
    try {
      reasons.push(...(await assessCreatorReputation(creatorWallet)))
    } catch (e) {
      reasons.push(
        `Creator reputation check failed: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  const curve = resolveCurveParams({
    curveType: body.curveType === 'custom' ? 'custom' : 'justsendit',
    supply: Number(body.supply),
    solTarget: Number(body.solTarget),
    totalLockedAmount: body.totalLockedAmount != null ? Number(body.totalLockedAmount) : 0,
    cliffPeriodSec: body.cliffPeriodSec != null ? Number(body.cliffPeriodSec) : 0,
    unlockPeriodSec: body.unlockPeriodSec != null ? Number(body.unlockPeriodSec) : 0,
  })
  if (curve.ok === false) {
    reasons.push(...curve.reasons)
  }

  if (reasons.length > 0) {
    return NextResponse.json(
      { blocked: true, reasons, compliance: LAUNCH_COMPLIANCE },
      { status: 403 },
    )
  }

  if (curve.ok !== true) {
    return NextResponse.json(
      { blocked: true, reasons: ['Invalid curve parameters'], compliance: LAUNCH_COMPLIANCE },
      { status: 403 },
    )
  }

  const curveParams = curve.params

  if (!process.env.LAUNCHLAB_PLATFORM_ID?.trim()) {
    return NextResponse.json(
      {
        blocked: true,
        reasons: [
          'LAUNCHLAB_PLATFORM_ID not configured — operator must run scripts/create-platform.ts first',
        ],
        compliance: LAUNCH_COMPLIANCE,
      },
      { status: 503 },
    )
  }

  try {
    const built = await buildLaunchTransactions({
      name,
      ticker: ticker.toUpperCase(),
      description,
      imageUrl,
      creatorWallet,
      curve: curveParams,
    })

    return NextResponse.json(
      {
        blocked: false,
        ...built,
        compliance: LAUNCH_COMPLIANCE,
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      {
        error: 'Failed to build launch transaction',
        detail: e instanceof Error ? e.message : String(e),
        compliance: LAUNCH_COMPLIANCE,
      },
      { status: 502 },
    )
  }
}
