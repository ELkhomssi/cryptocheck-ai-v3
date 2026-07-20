import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { submitSignedExecution, execMetricInc, EXEC_METRICS } from '@/lib/execution'
import type { ExecutionStrategyMode } from '@/lib/execution'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/execution/submit
 * Accepts a wallet-signed tx (base64). Tries Jito bundle when enabled, else RPC.
 * Never signs — custody stays with the user.
 *
 * Body: { signedTxBase64, strategy?, allowRpcFallback?, opportunityId? }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const signedTxBase64 = String(body.signedTxBase64 ?? body.signedTransaction ?? '').trim()
  const allowRpcFallback = body.allowRpcFallback !== false
  const strategy = (typeof body.strategy === 'string' ? body.strategy : 'balanced') as ExecutionStrategyMode

  if (!signedTxBase64 || signedTxBase64.length < 32) {
    return NextResponse.json({ error: 'signedTxBase64 required' }, { status: 400 })
  }

  try {
    const result = await submitSignedExecution({
      signedTxBase64,
      allowRpcFallback,
      opportunity: { strategy },
    })

    if (result.error && !result.signature && !result.bundleId) {
      execMetricInc(EXEC_METRICS.bundleFail, { stage: 'submit_api' })
      return NextResponse.json(
        { error: result.error, ...result },
        { status: 502, headers: { 'cache-control': 'no-store' } },
      )
    }

    return NextResponse.json(
      {
        ok: true,
        ...result,
        opportunityId: typeof body.opportunityId === 'string' ? body.opportunityId : undefined,
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Submit failed' },
      { status: 502 },
    )
  }
}
