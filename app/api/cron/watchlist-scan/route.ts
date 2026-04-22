import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { scanTokenIntelligence } from '@/lib/services/scanner/execute-scan'
import { sendTelegramAlert } from '@/lib/telegram/send-alert'
import { sendEmailAlert } from '@/lib/email/send-alert'
import { dispatchInstitutionalWebhooks } from '@/lib/webhooks/dispatch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type WatchRow = {
  id: string
  user_id: string
  mint: string
  last_risk_score: number | null
  last_verdict: string | null
}

type PrefsRow = {
  user_id: string
  telegram_chat_id: string | null
  telegram_alerts_enabled: boolean | null
  email_alerts_enabled: boolean | null
  min_risk_change: number | null
}

function worseVerdict(oldVerdict: string, nextVerdict: string): boolean {
  const severity: Record<string, number> = { SAFE: 0, CAUTION: 1, RISKY: 2, DANGER: 3 }
  return (severity[nextVerdict] ?? 0) > (severity[oldVerdict] ?? 0)
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getSupabaseAdmin()
  const { data: watchlist, error: watchErr } = await sb
    .from('watchlist')
    .select('id, user_id, mint, last_risk_score, last_verdict')

  if (watchErr) {
    console.error('[cron/watchlist] read watchlist failed', watchErr)
    return NextResponse.json({ error: 'Failed to read watchlist' }, { status: 500 })
  }

  const prefsByUser = new Map<string, PrefsRow>()
  const userIds = Array.from(new Set((watchlist ?? []).map((w) => String(w.user_id)).filter(Boolean)))
  if (userIds.length > 0) {
    const { data: prefsRows } = await sb
      .from('alert_preferences')
      .select('user_id, telegram_chat_id, telegram_alerts_enabled, email_alerts_enabled, min_risk_change')
      .in('user_id', userIds)
    for (const row of (prefsRows ?? []) as PrefsRow[]) prefsByUser.set(row.user_id, row)
  }

  let alertsTriggered = 0
  const failures: Array<{ mint: string; reason: string }> = []
  const deliveryAttempts: Array<{
    userId: string
    mint: string
    channel: 'telegram' | 'email'
    status: 'sent' | 'failed'
  }> = []

  for (const item of (watchlist ?? []) as WatchRow[]) {
    try {
      const newScan = await scanTokenIntelligence({ mint: item.mint, mode: 'full' })
      const oldScore = item.last_risk_score ?? 0
      const oldVerdict = item.last_verdict ?? 'SAFE'
      const scoreDelta = newScan.riskScore - oldScore

      await sb
        .from('watchlist')
        .update({
          last_risk_score: newScan.riskScore,
          last_verdict: newScan.verdict,
          last_scanned_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      const prefs = prefsByUser.get(item.user_id)
      const minChange = prefs?.min_risk_change ?? 10
      const shouldAlert = scoreDelta >= minChange || worseVerdict(oldVerdict, newScan.verdict)
      if (!shouldAlert) continue

      void dispatchInstitutionalWebhooks(item.user_id, 'risk.changed', {
        mint: item.mint,
        oldRiskScore: oldScore,
        newRiskScore: newScan.riskScore,
        oldVerdict,
        newVerdict: newScan.verdict,
      })

      if (prefs?.telegram_alerts_enabled && prefs.telegram_chat_id) {
        const sent = await sendTelegramAlert(prefs.telegram_chat_id, {
          mint: item.mint,
          oldScore,
          newScore: newScan.riskScore,
          oldVerdict,
          newVerdict: newScan.verdict,
        })
        await sb.from('alert_history').insert({
          user_id: item.user_id,
          mint: item.mint,
          old_risk_score: oldScore,
          new_risk_score: newScan.riskScore,
          old_verdict: oldVerdict,
          new_verdict: newScan.verdict,
          delivery_channel: 'telegram',
          delivery_status: sent ? 'sent' : 'failed',
        })
        deliveryAttempts.push({
          userId: item.user_id,
          mint: item.mint,
          channel: 'telegram',
          status: sent ? 'sent' : 'failed',
        })
        if (sent) alertsTriggered++
      }

      if (prefs?.email_alerts_enabled) {
        const sent = await sendEmailAlert({
          userId: item.user_id,
          mint: item.mint,
          oldScore,
          newScore: newScan.riskScore,
          oldVerdict,
          newVerdict: newScan.verdict,
        })
        await sb.from('alert_history').insert({
          user_id: item.user_id,
          mint: item.mint,
          old_risk_score: oldScore,
          new_risk_score: newScan.riskScore,
          old_verdict: oldVerdict,
          new_verdict: newScan.verdict,
          delivery_channel: 'email',
          delivery_status: sent ? 'sent' : 'failed',
        })
        deliveryAttempts.push({
          userId: item.user_id,
          mint: item.mint,
          channel: 'email',
          status: sent ? 'sent' : 'failed',
        })
        if (sent) alertsTriggered++
      }
    } catch (err) {
      console.error('[cron/watchlist] item failed', item.mint, err)
      failures.push({ mint: item.mint, reason: err instanceof Error ? err.message : 'unknown' })
    }
  }

  return NextResponse.json({
    watchlistSize: watchlist?.length ?? 0,
    alertsTriggered,
    failures,
    deliveryAttempts,
    diagnostics: {
      /** True when the Next.js process has a non-empty TELEGRAM_BOT_TOKEN (same env the sender uses). */
      telegramBotTokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
    },
  })
}
