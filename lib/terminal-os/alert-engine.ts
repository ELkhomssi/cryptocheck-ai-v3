/**
 * Shared alert evaluation against a live snapshot.
 * Used by POST /evaluate and the SSE alerts stream.
 */
import 'server-only'

import {
  appendFiredAlert,
  listAlertRules,
  listFiredAlerts,
} from '@/lib/terminal-os/alert-store'
import { evaluateCondition } from '@/lib/terminal-os/alert-evaluate'
import type { FiredAlert } from '@/lib/terminal-os/alert-types'

export type EvaluateSnapshot = {
  prices?: Record<string, number>
  whaleScore?: number
  riskScore?: number
  /** Decision.confidence — only source for ai_signal numeric rules */
  aiConfidence?: number
  /** Decision.action — for ai_signal field=action equality rules */
  decisionAction?: string
}

export async function evaluateAlertsForWallet(
  wallet: string,
  snapshot: EvaluateSnapshot,
): Promise<{ fired: FiredAlert[]; activeRules: number }> {
  const rules = (await listAlertRules(wallet)).filter((r) => r.active)
  const existing = await listFiredAlerts(wallet, 100)
  const recentRuleIds = new Set(
    existing
      .filter((f) => Date.now() - new Date(f.firedAt).getTime() < 5 * 60_000)
      .map((f) => f.ruleId),
  )

  const newly: FiredAlert[] = []
  const prices = snapshot.prices ?? {}

  for (const rule of rules) {
    if (recentRuleIds.has(rule.id)) continue
    let current: number | string | null = null
    if (rule.type === 'price') {
      current =
        prices[rule.target.id] ??
        (rule.target.symbol ? prices[rule.target.symbol] : undefined) ??
        null
    } else if (rule.type === 'whale_movement') {
      current = typeof snapshot.whaleScore === 'number' ? snapshot.whaleScore : null
    } else if (rule.type === 'security_flag' || rule.type === 'portfolio_risk') {
      current = typeof snapshot.riskScore === 'number' ? snapshot.riskScore : null
    } else if (rule.type === 'ai_signal') {
      // Layer 3 Decision only — never invent confidence here
      if (rule.condition.field === 'action' || rule.condition.field === 'decision.action') {
        current = snapshot.decisionAction ?? null
      } else {
        current = typeof snapshot.aiConfidence === 'number' ? snapshot.aiConfidence : null
      }
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

  return { fired: newly, activeRules: rules.length }
}
