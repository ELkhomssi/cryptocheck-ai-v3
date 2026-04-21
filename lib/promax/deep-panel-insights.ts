import 'server-only'

import { buildHeliusApiUrl, rpcCall } from '@/lib/helius-server'
import type { ExitIntelFacts } from '@/lib/token-exit-intel'
import { isSplMintRenounced } from '@/lib/token-exit-intel'
export type ForensicLogLine = { tag: string; color: string; msg: string; priority?: 'high' | 'normal' }

function firstKey(tx: unknown): string | null {
  const t = tx as {
    transaction?: { message?: { accountKeys?: Array<string | { pubkey?: string }> } }
  }
  const keys = t?.transaction?.message?.accountKeys
  if (!keys?.length) return null
  const k0 = keys[0]
  return typeof k0 === 'string' ? k0 : k0?.pubkey ?? null
}

/** Sample oldest signature in a short window → fee payer as proxy for early funding path. */
export async function collectFundingFeePayers(ownerWallets: string[], sample: number): Promise<string[]> {
  const payers: string[] = []
  for (const owner of ownerWallets.slice(0, sample)) {
    if (!owner) {
      payers.push('')
      continue
    }
    try {
      const sigs = await rpcCall<Array<{ signature: string }>>('getSignaturesForAddress', [
        owner,
        { limit: 25 },
      ])
      if (!Array.isArray(sigs) || !sigs.length) {
        payers.push('')
        continue
      }
      const oldestSig = sigs[sigs.length - 1]?.signature
      if (!oldestSig) {
        payers.push('')
        continue
      }
      const tx = await rpcCall<unknown>('getTransaction', [
        oldestSig,
        { encoding: 'json', maxSupportedTransactionVersion: 0 },
      ])
      payers.push(firstKey(tx) || '')
    } catch {
      payers.push('')
    }
  }
  return payers
}

export function computeClusterRiskPct(args: {
  facts: ExitIntelFacts
  holderOwners: (string | null)[]
  fundingFeePayers: string[]
  devWallets: string[]
}): { clusterRiskPct: number; holdersAnalyzed: number; sharedFundingCount: number; devLinkedHolders: number } {
  const { facts, holderOwners, fundingFeePayers, devWallets } = args
  const devSet = new Set(devWallets.filter(Boolean))

  const owners = holderOwners.filter((o): o is string => !!o)
  const holdersAnalyzed = owners.length

  const top5Proxy = holdersAnalyzed >= 5 ? Math.min(100, facts.top1Pct * 1.28) : facts.top1Pct
  let base = Math.min(40, facts.top1Pct * 0.38) + Math.min(28, Math.max(0, top5Proxy - 42) * 0.55)

  const freq = new Map<string, number>()
  for (const p of fundingFeePayers) {
    if (!p) continue
    freq.set(p, (freq.get(p) || 0) + 1)
  }
  let maxShared = 0
  for (const c of freq.values()) maxShared = Math.max(maxShared, c)
  const sharedBoost = maxShared >= 4 ? Math.min(28, (maxShared - 3) * 9) : maxShared === 3 ? 12 : 0

  let devLinkedHolders = 0
  for (const fp of fundingFeePayers) {
    if (fp && devSet.has(fp)) devLinkedHolders++
  }
  for (const o of owners) {
    if (o && devSet.has(o)) devLinkedHolders++
  }
  const devBoost = Math.min(22, devLinkedHolders * 11)

  const clusterRiskPct = Math.max(0, Math.min(100, Math.round(base + sharedBoost + devBoost)))
  return { clusterRiskPct, holdersAnalyzed, sharedFundingCount: maxShared, devLinkedHolders }
}

export function buildSecurityPulse(facts: ExitIntelFacts): { label: string; complexity: number } {
  const parts: string[] = []
  let complexity = 12
  if (!isSplMintRenounced(facts.splMintAuthority)) {
    parts.push('Mint authority live')
    complexity += 28
  }
  if (facts.splFreezeAuthority) {
    parts.push('Freeze authority set')
    complexity += 18
  }
  if (facts.metadataUpdateAuthority) {
    parts.push('Metadata mutable')
    complexity += 14
  }
  if (facts.top1Pct > 45) {
    parts.push('Extreme top-1 concentration')
    complexity += 16
  } else if (facts.top1Pct > 25) {
    parts.push('Elevated holder skew')
    complexity += 8
  }
  if (facts.liquidityUsd > 0 && facts.liquidityUsd < 20_000) {
    parts.push('Thin liquidity')
    complexity += 10
  }
  const label = `Security pulse ${Math.min(100, complexity)}/100 — ${parts.join(' · ') || 'Low structural attack surface'}`
  return { label, complexity: Math.min(100, complexity) }
}

export function computeTimeToImpact(facts: ExitIntelFacts, lpBurnOrTransferHits: number): string {
  if (lpBurnOrTransferHits > 0) return 'Critical — LP vault activity in last poll'
  if (facts.pairAgeMin == null) return 'N/A — no DEX pool age'
  if (facts.pairAgeMin < 30) return `${30 - facts.pairAgeMin}m inside hyper-acute window`
  if (facts.pairAgeMin < 120) return `${120 - facts.pairAgeMin}m new-pool surveillance`
  if (facts.pairAgeMin < 1440) return `${Math.ceil((720 - Math.min(720, facts.pairAgeMin)) / 60)}h time-to-calm estimate`
  return 'Outside acute window — monitor routine'
}

export async function fetchLpForensicLines(pairAddress: string | null): Promise<{
  lines: ForensicLogLine[]
  burnOrTransferHits: number
}> {
  if (!pairAddress) return { lines: [], burnOrTransferHits: 0 }
  let txs: unknown[] = []
  try {
    const url = buildHeliusApiUrl(`/addresses/${pairAddress}/transactions`, { limit: 35 })
    const res = await fetch(url)
    if (res.ok) {
      const raw = await res.json()
      txs = Array.isArray(raw) ? raw : Array.isArray((raw as { transactions?: unknown[] }).transactions) ? (raw as { transactions: unknown[] }).transactions : []
    }
  } catch {
    return { lines: [], burnOrTransferHits: 0 }
  }
  if (!Array.isArray(txs)) return { lines: [], burnOrTransferHits: 0 }

  const lines: ForensicLogLine[] = []
  let hits = 0
  const seen = new Set<string>()
  for (const tx of txs.slice(0, 35)) {
    const sig = typeof (tx as { signature?: string }).signature === 'string' ? (tx as { signature: string }).signature : ''
    if (!sig || seen.has(sig)) continue
    seen.add(sig)
    const blob = JSON.stringify(tx).toLowerCase()
    const isBurn = /burn|closeaccount|close_account/.test(blob)
    const isXfer = /transfer|transferchecked/.test(blob)
    if (isBurn) {
      hits++
      lines.push({
        tag: 'LP_ALERT',
        color: '#ff4444',
        msg: `High-priority: burn / close pattern on pair vault — ${sig.slice(0, 12)}…`,
        priority: 'high',
      })
    } else if (isXfer) {
      hits++
      lines.push({
        tag: 'LP_FLOW',
        color: '#f0a500',
        msg: `Liquidity movement (transfer class) — ${sig.slice(0, 12)}…`,
        priority: 'high',
      })
    }
  }
  if (!lines.length) {
    lines.push({
      tag: 'LP_MONITOR',
      color: '#20b2aa',
      msg: 'No burn/transfer-class LP signals in latest Helius batch — pool quiet.',
      priority: 'normal',
    })
  }
  return { lines, burnOrTransferHits: hits }
}
