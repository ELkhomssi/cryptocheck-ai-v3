import { NextResponse } from 'next/server'
import { Connection, VersionedTransaction } from '@solana/web3.js'
import { getRpcUrl } from '@/lib/launch/config'
import { classifyLaunchError, launchErrorResponse, newTrackingId } from '@/lib/launch/errors'
import { LAUNCH_COMPLIANCE } from '@/lib/launch/types'
import { enforceRateLimit } from '@/lib/services/rate-limit.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/launch/simulate
 * Simulates base64 VersionedTransactions before the user broadcasts.
 * Never signs. Never sends.
 */
export async function POST(req: Request) {
  const trackingId = newTrackingId()
  try {
    const body = (await req.json().catch(() => ({}))) as {
      transactions?: string[]
      creatorWallet?: string
    }
    const txs = Array.isArray(body.transactions) ? body.transactions : []
    if (!txs.length) {
      const { body: err, status } = launchErrorResponse('SIMULATION_FAILED', {
        trackingId,
        detail: 'transactions[] required',
        compliance: LAUNCH_COMPLIANCE,
        status: 400,
      })
      return NextResponse.json(err, { status })
    }

    const rlKey =
      body.creatorWallet?.trim() ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'anon'
    try {
      const rl = await enforceRateLimit(`launch:simulate:${rlKey}`, 'free')
      if (!rl.ok) {
        const { body: err, status } = launchErrorResponse('RATE_LIMITED', {
          trackingId,
          compliance: LAUNCH_COMPLIANCE,
        })
        return NextResponse.json(err, { status })
      }
    } catch {
      // fail open when rate-limit infra is down
    }

    const connection = new Connection(getRpcUrl(), 'confirmed')
    const results: Array<{
      index: number
      ok: boolean
      unitsConsumed: number | null
      logs: string[]
      err: unknown
    }> = []

    for (let i = 0; i < txs.length; i++) {
      const tx = VersionedTransaction.deserialize(Buffer.from(txs[i], 'base64'))
      const sim = await connection.simulateTransaction(tx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      })
      results.push({
        index: i,
        ok: !sim.value.err,
        unitsConsumed: sim.value.unitsConsumed ?? null,
        logs: sim.value.logs ?? [],
        err: sim.value.err ?? null,
      })
    }

    const allOk = results.every((r) => r.ok)
    return NextResponse.json(
      {
        ok: allOk,
        results,
        trackingId,
        compliance: LAUNCH_COMPLIANCE,
      },
      { status: allOk ? 200 : 422, headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    const code = classifyLaunchError(e)
    const { body, status } = launchErrorResponse(code === 'UNKNOWN' ? 'SIMULATION_FAILED' : code, {
      trackingId,
      detail: e instanceof Error ? e.message : String(e),
      compliance: LAUNCH_COMPLIANCE,
    })
    return NextResponse.json(body, { status })
  }
}
