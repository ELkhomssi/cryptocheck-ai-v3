import { NextRequest, NextResponse } from 'next/server'
import { withProFeature } from '@/lib/auth/pro-feature-access'
import { scanViaGateway, gatewayResponseHeaders } from '@/lib/connect/scan-gateway'

export const dynamic = 'force-dynamic'

/**
 * Pro-only: explainable reasoning — backed by the same pipeline + cache as POST `/api/v1/scan`.
 */
export const POST = withProFeature(async (req: NextRequest, ctx) => {
  const started = Date.now()
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const result = await scanViaGateway(req, ctx, body)
    if (result.ok === false) {
      const err = result.error
      return NextResponse.json(err.toJSON(), { status: err.httpStatus, headers: gatewayResponseHeaders() })
    }
    const { snapshot, meta } = result
    return NextResponse.json(
      { reasoning: snapshot.reasoning, cache: meta.cache },
      {
        headers: gatewayResponseHeaders({
          'X-Cache': meta.cache === 'hit' ? 'HIT' : 'MISS',
          'X-Response-Time-Ms': String(Date.now() - started),
          'X-RPC-Provider': snapshot.rpcProviderLabel,
        }),
      }
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Scan failed'
    return NextResponse.json({ error: msg }, { status: 500, headers: gatewayResponseHeaders() })
  }
})
