import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'
import { buildLaunchTransactions } from '@/lib/launch/build-launch'
import { getPlatformId, getRpcUrl } from '@/lib/launch/config'
import { isLaunchModePaused } from '@/lib/launch/control'
import { resolveCurveParams } from '@/lib/launch/curve-params'
import { assessCreatorReputation } from '@/lib/launch/creator-reputation'
import { estimateLaunchFees } from '@/lib/launch/estimate-fees'
import { classifyLaunchError, launchErrorResponse, newTrackingId } from '@/lib/launch/errors'
import { isLaunchModeEnabled } from '@/lib/launch/feature-flag'
import { assertPlatformConfigValid } from '@/lib/launch/guards'
import { isPinataConfigured } from '@/lib/launch/metadata-pinata'
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
export async function POST(req: NextRequest) {
  const trackingId = newTrackingId()

  try {
    await assertPlatformConfigValid(new Connection(getRpcUrl(), 'confirmed'))
  } catch (e) {
    const { body, status } = launchErrorResponse('CONFIG_INVALID', {
      trackingId,
      detail: e instanceof Error ? e.message : String(e),
      compliance: LAUNCH_COMPLIANCE,
    })
    return NextResponse.json({ ...body, blocked: true, reasons: [body.error] }, { status })
  }

  if (await isLaunchModePaused()) {
    const { body, status } = launchErrorResponse('LAUNCH_PAUSED', {
      trackingId,
      compliance: LAUNCH_COMPLIANCE,
    })
    return NextResponse.json(
      {
        ...body,
        blocked: true,
        reasons: [
          'LAUNCH_MODE_PAUSED is active — new token creates are rejected. Scan/Swap/Sniper are unaffected.',
        ],
      },
      { status },
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
        trackingId,
      },
      { status: 503 },
    )
  }

  const body = (await req.json().catch(() => ({}))) as Partial<LaunchPrepareInput>
  const creatorWallet = String(body.creatorWallet ?? '').trim()

  const rlKey = creatorWallet || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon'
  let rl: Awaited<ReturnType<typeof enforceRateLimit>>
  try {
    rl = await enforceRateLimit(`launch:prepare:${rlKey}`, 'free')
  } catch {
    rl = { ok: true, limit: 0, remaining: 0, reset: Date.now() }
  }
  if (!rl.ok) {
    const { body, status } = launchErrorResponse('RATE_LIMITED', {
      trackingId,
      compliance: LAUNCH_COMPLIANCE,
    })
    return NextResponse.json({ ...body, blocked: true }, { status })
  }

  // Phase 18 — LaunchLab create is Pro-gated
  {
    const { resolveIdentityWithLookup } = await import('@/lib/identity/resolve')
    const { isEntitled, entitlementDeniedBody } = await import('@/lib/identity/entitlements')
    const identity = await resolveIdentityWithLookup(req)
    if (!identity.userId || !(await isEntitled(identity.userId, 'launchlab_create'))) {
      return NextResponse.json(
        {
          ...entitlementDeniedBody('launchlab_create'),
          blocked: true,
          trackingId,
        },
        { status: 402 },
      )
    }
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

  reasons.push(...screenLaunchMetadata({ name, ticker, description, imageUrl }))

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
      { blocked: true, reasons, compliance: LAUNCH_COMPLIANCE, trackingId },
      { status: 403 },
    )
  }

  if (curve.ok !== true) {
    return NextResponse.json(
      {
        blocked: true,
        reasons: ['Invalid curve parameters'],
        compliance: LAUNCH_COMPLIANCE,
        trackingId,
      },
      { status: 403 },
    )
  }

  try {
    getPlatformId()
  } catch {
    return NextResponse.json(
      {
        blocked: true,
        reasons: [
          'LAUNCHLAB_PLATFORM_ID not configured — operator must run scripts/create-platform.ts first',
        ],
        compliance: LAUNCH_COMPLIANCE,
        trackingId,
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
      curve: curve.params,
      website: body.website,
      twitter: body.twitter,
      telegram: body.telegram,
      discord: body.discord,
    })

    const feeEstimate = await estimateLaunchFees({
      creatorWallet,
      metadataProvider: isPinataConfigured() ? 'ipfs' : 'self-hosted',
    })

    return NextResponse.json(
      {
        blocked: false,
        ...built,
        feeEstimate,
        trackingId,
        compliance: LAUNCH_COMPLIANCE,
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    const code = classifyLaunchError(e)
    const { body: err, status } = launchErrorResponse(
      code === 'UNKNOWN' ? 'UNKNOWN' : code,
      {
        trackingId,
        detail: e instanceof Error ? e.message : String(e),
        compliance: LAUNCH_COMPLIANCE,
      },
    )
    return NextResponse.json(err, { status })
  }
}
