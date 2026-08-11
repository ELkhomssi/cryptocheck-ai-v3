/**
 * Wallet scan → trader feedback (6h cadence).
 * Reuses holdings + scan gateway — no new scoring engine.
 * Keys: ccai:tos:wallet-feedback:{wallet} · ccai:tos:wallet-feedback:index
 */

import 'server-only'

import { redis } from '@/lib/cache/redis'
import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import { getPersistedDna } from '@/lib/terminal-os/dna-store'

export type WalletScanFinding = {
  mint: string
  symbol: string
  safetyScore: number
  riskScore: number
  verdict: string
  summary: string
}

export type WalletScanFeedback = {
  at: string
  wallet: string
  holdingsScanned: number
  findings: WalletScanFinding[]
  /** Coach-facing lines derived only from real scan + holdings — never invented advice. */
  coachLines: string[]
  dnaSampleSize: number | null
}

const FEEDBACK_PREFIX = 'ccai:tos:wallet-feedback:'
const INDEX_KEY = 'ccai:tos:wallet-feedback:index'
const TTL_SEC = 60 * 60 * 18 // keep until next ~6h cycle + buffer

function feedbackKey(wallet: string) {
  return `${FEEDBACK_PREFIX}${wallet.toLowerCase()}`
}

async function loadCandidateWallets(): Promise<string[]> {
  const out = new Set<string>()
  try {
    const raw = await redis.get('ccai:tos:rotation:watchlist')
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      if (Array.isArray(parsed)) parsed.filter(Boolean).forEach((w) => out.add(w))
    }
  } catch {
    /* ignore */
  }
  try {
    const idx = await redis.get(INDEX_KEY)
    if (idx) {
      const parsed = JSON.parse(idx) as string[]
      if (Array.isArray(parsed)) parsed.filter(Boolean).forEach((w) => out.add(w))
    }
  } catch {
    /* ignore */
  }
  return [...out].slice(0, 12)
}

export async function registerWalletForScanFeedback(wallet: string): Promise<void> {
  const w = wallet.trim()
  if (!w || w.length < 32) return
  try {
    const raw = await redis.get(INDEX_KEY)
    let ids: string[] = []
    if (raw) {
      try {
        ids = JSON.parse(raw) as string[]
      } catch {
        ids = []
      }
    }
    if (!Array.isArray(ids)) ids = []
    const next = [w, ...ids.filter((x) => x !== w)].slice(0, 48)
    await redis.setex(INDEX_KEY, TTL_SEC * 7, JSON.stringify(next))
  } catch {
    /* best-effort */
  }
}

export async function getWalletScanFeedback(wallet: string): Promise<WalletScanFeedback | null> {
  const raw = await redis.get(feedbackKey(wallet))
  if (!raw) return null
  try {
    return JSON.parse(raw) as WalletScanFeedback
  } catch {
    return null
  }
}

export async function runWalletScanFeedbackForWallet(wallet: string): Promise<WalletScanFeedback> {
  const w = wallet.trim()
  const holdings = await buildHoldingsResponse(w).catch(() => null)
  const rows = (holdings?.holdings ?? [])
    .filter((h) => (h.valueUsd ?? 0) > 1)
    .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0))
    .slice(0, 8)

  const findings: WalletScanFinding[] = []
  for (const h of rows) {
    try {
      // ~80–200ms estimated — scan gateway only (frozen scanner untouched)
      const assess = await assessRiskByMint(h.mint, 'solana', 'fast')
      const summary =
        assess.snapshot.reasoning.evidence[0]?.detail ??
        assess.snapshot.reasoning.clusterAnalysis.summary ??
        `Safety ${assess.safetyScore} · risk ${assess.riskScore}`
      findings.push({
        mint: h.mint,
        symbol: h.symbol || h.mint.slice(0, 4),
        safetyScore: assess.safetyScore,
        riskScore: assess.riskScore,
        verdict: String(assess.verdict),
        summary: summary.slice(0, 180),
      })
    } catch {
      /* skip mint */
    }
  }

  const dna = await getPersistedDna(w).catch(() => null)
  const coachLines: string[] = []
  if (!rows.length) {
    coachLines.push('Wallet scan: no Solana holdings above $1 to review this cycle.')
  } else {
    coachLines.push(
      `Wallet scan (${new Date().toISOString().slice(0, 16)}Z): reviewed ${findings.length}/${rows.length} holdings via Security Scanner.`,
    )
  }
  const danger = findings.filter(
    (f) =>
      f.verdict === 'HIGH_RISK' ||
      f.verdict === 'BLOCKED' ||
      f.safetyScore < 45,
  )
  const caution = findings.filter(
    (f) => !danger.includes(f) && (f.verdict === 'CAUTION' || f.safetyScore < 65),
  )
  for (const f of danger.slice(0, 3)) {
    coachLines.push(`⚠ ${f.symbol}: ${f.verdict} (safety ${f.safetyScore}) — ${f.summary}`)
  }
  for (const f of caution.slice(0, 2)) {
    coachLines.push(`${f.symbol}: ${f.verdict} (safety ${f.safetyScore}) — ${f.summary}`)
  }
  if (dna && dna.sampleSize >= 3) {
    coachLines.push(
      `Trader DNA trained on ${dna.sampleSize} real fills — Trade Like Me uses this profile (not a new opinion).`,
    )
  } else {
    coachLines.push(
      'Trader DNA still training — execute (or skip) via AI Gateway so captures feed Trade Like Me.',
    )
  }

  const payload: WalletScanFeedback = {
    at: new Date().toISOString(),
    wallet: w,
    holdingsScanned: rows.length,
    findings,
    coachLines,
    dnaSampleSize: dna?.sampleSize ?? null,
  }
  await redis.setex(feedbackKey(w), TTL_SEC, JSON.stringify(payload))
  await registerWalletForScanFeedback(w)
  return payload
}

export async function runWalletScanFeedbackTick(): Promise<{
  wallets: number
  scanned: number
  at: string
}> {
  const wallets = await loadCandidateWallets()
  let scanned = 0
  for (const w of wallets) {
    try {
      await runWalletScanFeedbackForWallet(w)
      scanned += 1
    } catch (err) {
      console.error('[wallet-scan-feedback] wallet failed', w.slice(0, 8), err)
    }
  }
  return { wallets: wallets.length, scanned, at: new Date().toISOString() }
}
