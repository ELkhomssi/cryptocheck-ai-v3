import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { generateSignalForMint } from '@/lib/services/signals/generate-signal'
import { fetchTokenMetrics } from '@/lib/dexscreener/fetch-token-metrics'
import { sendTelegramPlainMessage } from '@/lib/telegram/send-alert'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type TrackedRow = { user_id: string; mint: string; exited_at: string | null }
type PrefRow = { user_id: string; telegram_chat_id: string | null; telegram_alerts_enabled: boolean | null }
type SignalRow = {
  id: string
  mint: string
  verdict: string
  ai_reasoning: string | null
  whale_count: number | null
  net_flow_usd: number | null
}

type DexProfile = { chainId?: string; tokenAddress?: string }

function significantVerdictChange(prev: string | null, next: string): boolean {
  if (!prev) return true
  if (prev === next) return false
  const severe = new Set(['cautionary_flags', 'bearish_activity'])
  return severe.has(next) || severe.has(prev) || prev !== next
}

async function fetchTrendingSolanaMints(limit = 20): Promise<string[]> {
  try {
    const res = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', { cache: 'no-store' })
    if (!res.ok) return []
    const body = (await res.json()) as DexProfile[]
    return (Array.isArray(body) ? body : [])
      .filter((p) => p.chainId === 'solana' && typeof p.tokenAddress === 'string')
      .map((p) => p.tokenAddress as string)
      .slice(0, limit)
  } catch {
    return []
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getSupabaseAdmin()

  const { data: trackedRows } = await sb
    .from('tracked_opportunities')
    .select('user_id,mint,exited_at')
    .is('exited_at', null)

  const tracked = (trackedRows as TrackedRow[] | null) ?? []
  const trackedMints = tracked.map((r) => r.mint)
  const trending = await fetchTrendingSolanaMints(20)
  const targetMints = Array.from(new Set([...trackedMints, ...trending])).slice(0, 60)

  const { data: prefRows } = await sb
    .from('alert_preferences')
    .select('user_id,telegram_chat_id,telegram_alerts_enabled')
    .in(
      'user_id',
      Array.from(new Set(tracked.map((r) => r.user_id))).filter(Boolean)
    )
  const prefs = new Map((prefRows as PrefRow[] | null)?.map((p) => [p.user_id, p]) ?? [])

  let generated = 0
  let alertsSent = 0
  const failures: Array<{ mint: string; reason: string }> = []

  for (const mint of targetMints) {
    try {
      const { data: prevSignal } = await sb
        .from('intelligence_signals')
        .select('id,mint,verdict,ai_reasoning,whale_count,net_flow_usd')
        .eq('mint', mint)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const next = await generateSignalForMint({ mint })
      generated += 1

      if (!significantVerdictChange((prevSignal as SignalRow | null)?.verdict ?? null, next.verdict)) {
        continue
      }

      // Insert signal performance row for bankroll curve when verdict changes
      const { data: latestSignal } = await sb
        .from('intelligence_signals')
        .select('id')
        .eq('mint', mint)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const metrics = await fetchTokenMetrics(mint).catch(
        () => ({ priceUsd: null } as { priceUsd: number | null })
      )
      await sb.from('signal_performance').insert({
        signal_id: latestSignal?.id ?? null,
        mint,
        entry_price_usd: metrics.priceUsd ?? null,
        exit_price_usd: metrics.priceUsd ?? null,
        peak_price_usd: metrics.priceUsd ?? null,
        drawdown_pct: null,
        pnl_pct: null,
        holding_hours: 0,
        closed_at: new Date().toISOString(),
      })

      const trackedUsers = tracked.filter((r) => r.mint === mint)
      for (const row of trackedUsers) {
        const pref = prefs.get(row.user_id)
        const chatId = pref?.telegram_chat_id?.trim()
        if (pref?.telegram_alerts_enabled && chatId) {
          const symbol = mint.slice(0, 4)
          const url = `https://www.cryptocheckai.com/dashboard/intelligence-terminal?mint=${mint}`
          const jupiterUrl = `https://jup.ag/swap/SOL-${mint}`
          const msg = `
🧠 Intelligence Signal — $${symbol}

Verdict: ${next.verdict}
${next.summary}

Whales active: ${next.whaleCount}
Net flow (24h): $${Math.round(next.netFlowUsd).toLocaleString()}

View details: ${url}
Swap on Jupiter: ${jupiterUrl}

⚠ Informational only. Not financial advice.
`.trim()
          const sent = await sendTelegramPlainMessage(chatId, msg.replace(/\n/g, '<br/>'))
          if (sent) alertsSent += 1
        }

        // best-effort in-app alert row for existing history table
        try {
          await sb.from('alert_history').insert({
            user_id: row.user_id,
            mint,
            old_verdict: (prevSignal as SignalRow | null)?.verdict ?? null,
            new_verdict: next.verdict,
            delivery_channel: 'in_app',
            delivery_status: 'sent',
            old_risk_score: null,
            new_risk_score: null,
          })
        } catch {
          // best effort in-app record
        }
      }
    } catch (err) {
      failures.push({ mint, reason: err instanceof Error ? err.message : 'unknown' })
    }
  }

  return NextResponse.json({
    trackedMintCount: trackedMints.length,
    trendingMintCount: trending.length,
    processed: targetMints.length,
    generated,
    alertsSent,
    failures,
  })
}
