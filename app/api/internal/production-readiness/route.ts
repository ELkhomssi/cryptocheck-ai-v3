import { NextRequest, NextResponse } from 'next/server'
import { collectBillingReadiness, billingEnvChecklist } from '@/lib/billing/billing-readiness'
import { collectHealthSnapshot } from '@/lib/status/health-snapshot'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { resolveSignalRealtimeHttpBase, resolveSignalWsUrl, signalFeedMode } from '@/lib/signal-aggregator/runtime-config'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.INTERNAL_API_SECRET?.trim()
  if (!secret) return false
  const auth = req.headers.get('authorization')?.trim()
  if (auth === `Bearer ${secret}`) return true
  const q = req.nextUrl.searchParams.get('secret')?.trim()
  return q === secret
}

/**
 * GET /api/internal/production-readiness
 * Masked env + connectivity audit for Production debugging.
 * Auth: Bearer SIGNAL_WORKER_SECRET (or CRON_SECRET / INTERNAL_API_SECRET).
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const httpBase = resolveSignalRealtimeHttpBase()
  const wsUrl = resolveSignalWsUrl()

  let historyProbe: { ok: boolean; status?: number; error?: string; bodyPreview?: string } = {
    ok: false,
  }
  try {
    const res = await fetch(`${httpBase}/v1/history?limit=1`, { cache: 'no-store' })
    const text = await res.text()
    historyProbe = {
      ok: res.ok,
      status: res.status,
      bodyPreview: text.slice(0, 120),
      error: res.ok ? undefined : 'Upstream history failed',
    }
    if (text.includes('requested path is invalid')) {
      historyProbe.error =
        'SIGNAL_REALTIME_URL likely points to Upstash Redis REST — must be your realtime-gateway HTTP URL (or leave unset for Supabase-native history).'
    }
  } catch (e) {
    historyProbe.error = e instanceof Error ? e.message : 'History probe failed'
  }

  const [health, billing] = await Promise.all([collectHealthSnapshot(), collectBillingReadiness()])

  let signalRowCount: number | null = null
  try {
    const { count } = await getSupabaseAdmin()
      .from('signal_normalized')
      .select('id', { count: 'exact', head: true })
      .eq('dropped', false)
      .eq('sample', false)
    signalRowCount = count ?? 0
  } catch {
    signalRowCount = null
  }

  const realtimeLooksLocal =
    httpBase.includes('127.0.0.1') || httpBase.includes('localhost')

  return NextResponse.json({
    ts: new Date().toISOString(),
    health,
    signals: {
      signalNormalizedRows: signalRowCount,
      signalRealtimeUrlHost: (() => {
        try {
          return new URL(httpBase).host
        } catch {
          return 'invalid-url'
        }
      })(),
      signalRealtimeLooksLocal: realtimeLooksLocal,
      wsUrlHost: (() => {
        try {
          return new URL(wsUrl).host
        } catch {
          return 'invalid-url'
        }
      })(),
      historyProbe,
      nextPublicWsSet: Boolean(process.env.NEXT_PUBLIC_SIGNAL_WS_URL?.trim()),
    },
    billing: {
      ...billing,
      envChecklist: billingEnvChecklist(),
    },
    hints: [
      ...(signalFeedMode() === 'poll'
        ? ['Vercel-native poll mode — history reads Supabase directly; live Telegram ingestion still needs a worker or cron.']
        : []),
      ...(realtimeLooksLocal
        ? ['Unset SIGNAL_REALTIME_URL to use Vercel-native Supabase history, or set it to an external realtime gateway.']
        : []),
      ...(!historyProbe.ok ? [historyProbe.error ?? 'History upstream unreachable.'] : []),
      ...billing.hints,
    ].filter(Boolean),
  })
}
