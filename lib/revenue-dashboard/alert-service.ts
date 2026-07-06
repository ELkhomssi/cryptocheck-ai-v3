import 'server-only'

import { randomUUID } from 'crypto'
import { redis } from '@/lib/cache/redis'
import { getPortfolio, readPortfolioSnapshot } from '@/lib/portfolio/portfolio-tracker'
import { terminalExitDeepLink } from '@/lib/revenue-dashboard/constants'
import {
  isFlaggedVerdict,
  verdictFromRiskScore,
} from '@/lib/revenue-dashboard/portfolio-mapper'
import type { RevenueAlert, RevenueVerdict } from '@/lib/revenue-dashboard/types'

const OPTIN_PREFIX = 'ccai:rev:alert:optin:'
const ALERT_INDEX_PREFIX = 'ccai:rev:alerts:index:'
const ALERT_TTL_SEC = 60 * 60 * 24 * 30

function optInKey(wallet: string): string {
  return `${OPTIN_PREFIX}${wallet}`
}

function alertIndexKey(wallet: string): string {
  return `${ALERT_INDEX_PREFIX}${wallet}`
}

export async function getAlertOptIn(wallet: string): Promise<boolean> {
  try {
    const v = await redis.get(optInKey(wallet))
    return v === '1'
  } catch {
    return false
  }
}

export async function setAlertOptIn(wallet: string, enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await redis.setex(optInKey(wallet), ALERT_TTL_SEC, '1')
    } else {
      await redis.setex(optInKey(wallet), 1, '0')
    }
  } catch {
    /* best-effort */
  }
}

function verdictRank(v: RevenueVerdict): number {
  if (v === 'SAFE') return 0
  if (v === 'CAUTION') return 1
  return 2
}

function severityForTransition(prev: RevenueVerdict, next: RevenueVerdict): RevenueAlert['severity'] {
  if (next === 'DANGER' && prev !== 'DANGER') return 'critical'
  if (verdictRank(next) > verdictRank(prev)) return 'warning'
  return 'info'
}

async function listStoredAlertIds(wallet: string, limit = 50): Promise<string[]> {
  try {
    const raw = await redis.get(alertIndexKey(wallet))
    return raw ? (JSON.parse(raw) as string[]).slice(0, limit) : []
  } catch {
    return []
  }
}

export async function listAlerts(wallet: string, limit = 50): Promise<RevenueAlert[]> {
  const ids = await listStoredAlertIds(wallet, limit)
  const rows = await Promise.all(
    ids.map(async (id) => {
      const raw = await redis.get(`ccai:rev:alert:${id}`)
      return raw ? (JSON.parse(raw) as RevenueAlert) : null
    }),
  )
  return rows.filter((r): r is RevenueAlert => r != null)
}

async function storeAlert(alert: RevenueAlert): Promise<void> {
  try {
    await redis.setex(`ccai:rev:alert:${alert.id}`, ALERT_TTL_SEC, JSON.stringify(alert))
    const ids = await listStoredAlertIds(alert.walletAddress, 2000)
    const next = [alert.id, ...ids.filter((x) => x !== alert.id)].slice(0, 200)
    await redis.setex(alertIndexKey(alert.walletAddress), ALERT_TTL_SEC, JSON.stringify(next))
  } catch {
    /* best-effort */
  }
}

/**
 * Diff portfolio vs last snapshot; when verdict worsens for a held token, emit RevenueAlert.
 * Only runs when opt-in is enabled.
 */
export async function refreshAlertsForWallet(wallet: string): Promise<RevenueAlert[]> {
  const optedIn = await getAlertOptIn(wallet)
  if (!optedIn) return listAlerts(wallet)

  const prev = await readPortfolioSnapshot(wallet, 'solana')
  const portfolio = await getPortfolio(wallet, 'solana')
  const now = portfolio.lastUpdatedAt
  const prevByMint = new Map((prev?.positions ?? []).map((p) => [p.mint, p.riskScore]))
  const newAlerts: RevenueAlert[] = []

  for (const pos of portfolio.positions) {
    const prevScore = prevByMint.get(pos.mint)
    const prevVerdict = verdictFromRiskScore(prevScore ?? 0)
    const currentVerdict = verdictFromRiskScore(pos.riskScore)

    const worsened = verdictRank(currentVerdict) > verdictRank(prevVerdict)
    const newlyFlagged = isFlaggedVerdict(currentVerdict) && !isFlaggedVerdict(prevVerdict)

    if (!worsened && !newlyFlagged) continue
    if (prevScore == null && !isFlaggedVerdict(currentVerdict)) continue

    const alert: RevenueAlert = {
      id: `alert_${randomUUID()}`,
      walletAddress: wallet,
      mint: pos.mint,
      symbol: pos.symbol,
      previousVerdict: prevScore != null ? prevVerdict : 'SAFE',
      currentVerdict,
      message: `${pos.symbol} verdict worsened: ${prevVerdict} → ${currentVerdict} (risk ${pos.riskScore}/100).`,
      severity: severityForTransition(prevVerdict, currentVerdict),
      createdAt: now,
      read: false,
      terminalDeepLink: terminalExitDeepLink(pos.mint),
    }
    newAlerts.push(alert)
    await storeAlert(alert)
  }

  if (newAlerts.length === 0) return listAlerts(wallet)
  const merged = [...newAlerts, ...(await listAlerts(wallet))]
  const seen = new Set<string>()
  return merged.filter((a) => {
    const k = `${a.mint}:${a.createdAt}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export async function markAlertRead(wallet: string, alertId: string): Promise<void> {
  try {
    const raw = await redis.get(`ccai:rev:alert:${alertId}`)
    if (!raw) return
    const alert = JSON.parse(raw) as RevenueAlert
    if (alert.walletAddress !== wallet) return
    alert.read = true
    await redis.setex(`ccai:rev:alert:${alertId}`, ALERT_TTL_SEC, JSON.stringify(alert))
  } catch {
    /* ignore */
  }
}
