/**
 * Persist Terminal OS alert rules + fired history in Redis.
 * Keys: ccai:tos:alert:rules:{wallet} · ccai:tos:alert:fired:{wallet}
 */
import 'server-only'

import { redis } from '@/lib/cache/redis'
import type { AlertRule, FiredAlert } from './alert-types'

export { evaluateCondition } from './alert-evaluate'

const RULES_PREFIX = 'ccai:tos:alert:rules:'
const FIRED_PREFIX = 'ccai:tos:alert:fired:'
const TTL_SEC = 60 * 60 * 24 * 90

function rulesKey(wallet: string) {
  return `${RULES_PREFIX}${wallet}`
}
function firedKey(wallet: string) {
  return `${FIRED_PREFIX}${wallet}`
}

export async function listAlertRules(wallet: string): Promise<AlertRule[]> {
  try {
    const raw = await redis.get(rulesKey(wallet))
    if (!raw) return []
    const parsed = JSON.parse(raw) as AlertRule[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveAlertRules(wallet: string, rules: AlertRule[]): Promise<void> {
  await redis.setex(rulesKey(wallet), TTL_SEC, JSON.stringify(rules))
}

export async function upsertAlertRule(rule: AlertRule): Promise<AlertRule> {
  const rules = await listAlertRules(rule.wallet)
  const idx = rules.findIndex((r) => r.id === rule.id)
  if (idx >= 0) rules[idx] = rule
  else rules.unshift(rule)
  await saveAlertRules(rule.wallet, rules.slice(0, 100))
  return rule
}

export async function listFiredAlerts(wallet: string, limit = 50): Promise<FiredAlert[]> {
  try {
    const raw = await redis.get(firedKey(wallet))
    if (!raw) return []
    const parsed = JSON.parse(raw) as FiredAlert[]
    return (Array.isArray(parsed) ? parsed : []).slice(0, limit)
  } catch {
    return []
  }
}

export async function appendFiredAlert(alert: FiredAlert): Promise<void> {
  const existing = await listFiredAlerts(alert.wallet, 200)
  const next = [alert, ...existing.filter((a) => a.id !== alert.id)].slice(0, 200)
  await redis.setex(firedKey(alert.wallet), TTL_SEC, JSON.stringify(next))
}

export async function clearAlertStateForWallet(wallet: string): Promise<void> {
  try {
    await redis.del(rulesKey(wallet), firedKey(wallet))
  } catch {
    /* best-effort */
  }
}

