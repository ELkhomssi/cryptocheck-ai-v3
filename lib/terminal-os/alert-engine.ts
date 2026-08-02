/**
 * Shared alert evaluation against a live snapshot.
 * Used by POST /evaluate and the SSE alerts stream.
 * ai_signal reads the shared Decision store (same object as Discovery / Attention / Coach).
 */
import 'server-only'

import {
  appendFiredAlert,
  listAlertRules,
  listFiredAlerts,
} from '@/lib/terminal-os/alert-store'
import { evaluateCondition } from '@/lib/terminal-os/alert-evaluate'
import { listRecentDecisions, getDecisionByTokenId } from '@/lib/terminal-os/decision-store'
import type { FiredAlert } from '@/lib/terminal-os/alert-types'

export type EvaluateSnapshot = {
  prices?: Record<string, number>
  whaleScore?: number
  riskScore?: number
  aiConfidence?: number
  decisionAction?: string
}

async function resolveAiSignalFromStore(ruleTargetId?: string, ruleSymbol?: string): Promise<number | null> {
  if (ruleTargetId) {
    const byId = await getDecisionByTokenId(ruleTargetId)
    if (byId) return byId.marketConfidence ?? byId.confidence
  }
  const recent = await listRecentDecisions(12)
  if (ruleSymbol) {
    const match = recent.find(
      (d) => d.subject.kind === 'token' && d.subject.symbol.toUpperCase() === ruleSymbol.toUpperCase(),
    )
    if (match) return match.marketConfidence ?? match.confidence
  }
  const actionable = recent.find((d) => d.action === 'BUY' || d.action === 'SELL' || d.action === 'EXIT')
  if (actionable) return actionable.marketConfidence ?? actionable.confidence
  return recent[0] ? recent[0].marketConfidence ?? recent[0].confidence : null
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
    let current: number | null = null
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
      current =
        typeof snapshot.aiConfidence === 'number'
          ? snapshot.aiConfidence
          : await resolveAiSignalFromStore(rule.target.id, rule.target.symbol)
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
