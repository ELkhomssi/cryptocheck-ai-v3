import { NextResponse } from 'next/server'
import { estimateLaunchFees } from '@/lib/launch/estimate-fees'
import { newTrackingId, launchErrorResponse } from '@/lib/launch/errors'
import { isPinataConfigured } from '@/lib/launch/metadata-pinata'
import { LAUNCH_COMPLIANCE } from '@/lib/launch/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/launch/estimate-fees
 * Full fee breakdown before sign — no hidden fees.
 */
export async function POST(req: Request) {
  const trackingId = newTrackingId()
  try {
    const body = (await req.json().catch(() => ({}))) as { creatorWallet?: string }
    const fees = await estimateLaunchFees({
      creatorWallet: body.creatorWallet?.trim(),
      metadataProvider: isPinataConfigured() ? 'ipfs' : 'self-hosted',
    })
    return NextResponse.json(
      { ...fees, trackingId, compliance: LAUNCH_COMPLIANCE },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    const { body, status } = launchErrorResponse('UNKNOWN', {
      trackingId,
      detail: e instanceof Error ? e.message : String(e),
      compliance: LAUNCH_COMPLIANCE,
    })
    return NextResponse.json(body, { status })
  }
}

export async function GET(req: Request) {
  const trackingId = newTrackingId()
  try {
    const url = new URL(req.url)
    const creatorWallet = url.searchParams.get('creatorWallet')?.trim() || undefined
    const fees = await estimateLaunchFees({
      creatorWallet,
      metadataProvider: isPinataConfigured() ? 'ipfs' : 'self-hosted',
    })
    return NextResponse.json(
      { ...fees, trackingId, compliance: LAUNCH_COMPLIANCE },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    const { body, status } = launchErrorResponse('UNKNOWN', {
      trackingId,
      detail: e instanceof Error ? e.message : String(e),
      compliance: LAUNCH_COMPLIANCE,
    })
    return NextResponse.json(body, { status })
  }
}
