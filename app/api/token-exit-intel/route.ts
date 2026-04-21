import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/middleware/with-api-auth'
import { scanApiErrorPayload } from '@/lib/api/scan-api-errors'
import { fetchTokenExitIntelSnapshot } from '@/lib/token-exit-intel-server'

export const dynamic = 'force-dynamic'

export const POST = withApiAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const mint = typeof body?.mint === 'string' ? body.mint.trim() : ''
    if (!mint || mint.length < 32) {
      return NextResponse.json(
        scanApiErrorPayload('Invalid mint address', 400, 'INVALID_MINT', {
          reason: 'INVALID_MINT',
          severity: 'low',
        }),
        { status: 400 }
      )
    }

    const snap = await fetchTokenExitIntelSnapshot(mint)
    if (snap.ok === false) {
      const { code, message } = snap.error
      const status = code === 'MINT_NOT_FOUND' ? 404 : 400
      return NextResponse.json(
        scanApiErrorPayload(message, status, code, {
          reason: code,
          severity: 'low',
        }),
        { status }
      )
    }

    const data = snap.data
    const { facts } = data

    return NextResponse.json({
      mint: data.mint,
      symbol: data.symbol,
      splMintAuthority: data.splMintAuthority,
      splFreezeAuthority: data.splFreezeAuthority,
      metadataUpdateAuthority: data.metadataUpdateAuthority,
      isSplMintRenounced: data.isSplMintRenounced,
      isSplFullyRenounced: data.isSplFullyRenounced,
      iei: data.iei,
      neuralScore: data.neuralScore,
      acutePoolWindowEndMs: data.acutePoolWindowEndMs,
      pairCreatedAtMs: facts.pairCreatedAtMs,
      top1Pct: facts.top1Pct,
      liquidityUsd: facts.liquidityUsd,
      pairAgeMin: facts.pairAgeMin,
      dexUrl: data.dexUrl,
      scannedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[token-exit-intel]', err)
    return NextResponse.json(
      scanApiErrorPayload('Upstream intelligence sources unavailable', 502, 'UPSTREAM_ERROR', {
        reason: 'UPSTREAM_ERROR',
        severity: 'high',
      }),
      { status: 502 }
    )
  }
})
