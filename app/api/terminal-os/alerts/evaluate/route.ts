import { NextRequest, NextResponse } from 'next/server'
import {
  appendFiredAlert,
  listAlertRules,
  listFiredAlerts,
} from '@/lib/terminal-os/alert-store'
import { evaluateCondition } from '@/lib/terminal-os/alert-evaluate'
import type { FiredAlert } from '@/lib/terminal-os/alert-types'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/terminal-os/alerts/evaluate
 * Body: { wallet, prices?: Record<mintOrSymbol, number>, whaleScore?: number, riskScore?: number }
 * Evaluates active rules against live snapshot; persists newly fired alerts.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    wallet?: string
    prices?: Record<string, number>
    whaleScore?: number
    riskScore?: number
    aiConfidence?: number
  }
  const wallet = body.wallet?.trim() ?? ''
  if (!wallet || (!isValidSolanaMint(wallet) && !/^0x[a-fA-F0-9]{40}$/.test(wallet))) {
    return NextResponse.json({ error: 'Valid wallet required' }, { status: 400 })
  }

  const rules = (await listAlertRules(wallet)).filter((r) => r.active)
  const existing = await listFiredAlerts(wallet, 100)
  const recentRuleIds = new Set(
    existing
      .filter((f) => Date.now() - new Date(f.firedAt).getTime() < 5 * 60_000)
      .map((f) => f.ruleId),
  )

  const newly: FiredAlert[] = []
  const prices = body.prices ?? {}

  for (const rule of rules) {
    if (recentRuleIds.has(rule.id)) continue
    let current: number | null = null
    if (rule.type === 'price') {
      current =
        prices[rule.target.id] ??
        (rule.target.symbol ? prices[rule.target.symbol] : undefined) ??
        null
    } else if (rule.type === 'whale_movement') {
      current = typeof body.whaleScore === 'number' ? body.whaleScore : null
    } else if (rule.type === 'security_flag' || rule.type === 'portfolio_risk') {
      current = typeof body.riskScore === 'number' ? body.riskScore : null
    } else if (rule.type === 'ai_signal') {
      current = typeof body.aiConfidence === 'number' ? body.aiConfidence : null
    }
    if (current == null) continue
    if (!evaluateCondition(rule.condition, current)) continue

    const fired: FiredAlert = {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      wallet,
      firedAt: new Date().toISOString(),
      triggerValue: current,
      delivered: true,
      summary: `${rule.type} ${rule.condition.field} ${rule.condition.operator} ${rule.condition.value} (now ${current}) · ${rule.target.symbol ?? rule.target.id.slice(0, 8)}`,
    }
    await appendFiredAlert(fired)
    newly.push(fired)
  }

  return NextResponse.json(
    { ok: true, fired: newly, activeRules: rules.length },
    { headers: { 'cache-control': 'no-store' } },
  )
}
