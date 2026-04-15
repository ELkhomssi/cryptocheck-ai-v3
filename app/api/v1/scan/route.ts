import { NextRequest, NextResponse } from 'next/server'
import { withProFeature } from '@/lib/auth/pro-feature-access'
import { runInstitutionalScan } from '@/lib/services/scanner/execute-scan'

export const dynamic = 'force-dynamic'

/**
 * Unified institutional scan API — explainable score, pipeline trace, RPC source, simulation preview.
 * Pro / Institutional: session cookie or API key (same as `/api/v1/scan/reasoning`).
 */
export const POST = withProFeature(async (req: NextRequest, ctx) => {
  const started = Date.now()
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const result = await runInstitutionalScan(req, ctx, body)

  if (result.ok === false) {
    const err = result.error
    return NextResponse.json(err.toJSON(), { status: err.httpStatus })
  }

  const { snapshot, meta } = result
  const payload = {
    score: snapshot.weighted.score,
    confidence: snapshot.weighted.confidence,
    risk_breakdown: snapshot.weighted.risk_breakdown,
    reasoning: snapshot.reasoning,
    wallet_reputation: snapshot.walletReputation,
    simulator: snapshot.simulator,
    rpc_provider: snapshot.rpcProviderLabel,
    pipeline_stages: snapshot.stages,
    pipeline_ms: snapshot.totalPipelineMs,
    last_updated: snapshot.updatedAt,
    cache: meta.cache,
    meta: {
      response_time_ms: meta.responseTimeMs,
      auth_via: meta.authVia,
      user_id: meta.userId,
    },
  }

  return NextResponse.json(payload, {
    headers: {
      'X-Cache': meta.cache === 'hit' ? 'HIT' : 'MISS',
      'X-Response-Time-Ms': String(Date.now() - started),
      'X-RPC-Provider': snapshot.rpcProviderLabel,
    },
  })
})
