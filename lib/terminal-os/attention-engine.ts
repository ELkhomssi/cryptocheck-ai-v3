/**
 * Server Attention Engine — continuous evaluation independent of open tabs.
 * Compares live market/whale/security state to Redis fingerprints and only
 * emits AttentionItems when something genuinely changed.
 * No fabricated activity.
 */

import 'server-only'

import { resilientTokens, resilientWhales, warmTerminalOsCache } from '@/lib/terminal-os/resilient-feed'
import { adaptMarketToAttention } from '@/features/attention-feed/adapters/market-adapter'
import { adaptWhalesToAttention } from '@/features/attention-feed/adapters/whale-adapter'
import { adaptSecurityToAttention } from '@/features/attention-feed/adapters/security-adapter'
import { adaptPortfolioToAttention } from '@/features/attention-feed/adapters/coach-portfolio-adapter'
import { summaryFromHoldings } from '@/features/terminal-os/portfolio-os/lib/summary-from-holdings'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import { isValidSolanaWallet } from '@/lib/portfolio-desk/validate'
import { prioritizeAttentionItems } from '@/features/attention-feed/lib/prioritize'
import type { AttentionItem } from '@/features/attention-feed/types'
import {
  attentionFingerprint,
  getAttentionFingerprints,
  getAttentionSnapshot,
  saveAttentionSnapshot,
  type AttentionChangeKind,
  type AttentionFeedSnapshot,
  type AttentionLiveEvent,
} from '@/lib/terminal-os/attention-store'

function eventTypeFor(item: AttentionItem): AttentionLiveEvent['eventType'] {
  switch (item.sourceEngine) {
    case 'security-scanner':
      return 'SecurityFlagRaised'
    case 'portfolio-intelligence':
      return 'PortfolioChanged'
    case 'decision-engine':
      return 'DecisionMade'
    case 'ai-coach':
      return 'DNAUpdated'
    case 'wallet-intelligence':
      return 'WhaleFlow'
    default:
      return 'MarketContextChanged'
  }
}

/**
 * Volatility / whale-activity bands already used in scoring —
 * quiet tokens never enter the feed.
 */
function marketMaterialBand(change24hPct: number): string {
  const a = Math.abs(change24hPct)
  if (a >= 25) return 'x25'
  if (a >= 12) return 'x12'
  if (a >= 8) return 'x8'
  return 'quiet'
}

export type AttentionTickResult = {
  snapshot: AttentionFeedSnapshot
  changed: boolean
  newCount: number
  updatedCount: number
}

export async function runAttentionTick(opts?: {
  wallet?: string | null
}): Promise<AttentionTickResult> {
  await warmTerminalOsCache()

  const [tokensEnv, whalesEnv] = await Promise.all([
    resilientTokens('solana', 24),
    resilientWhales(16),
  ])

  const candidates: AttentionItem[] = [
    ...adaptMarketToAttention(tokensEnv.data ?? []),
    ...adaptWhalesToAttention(whalesEnv.data ?? []),
    ...adaptSecurityToAttention(tokensEnv.data ?? []),
  ]

  // Drop market items that never crossed a meaningful band (adapter already filters ≥8%)
  const filtered = candidates.filter((item) => {
    if (item.sourceEngine !== 'market-intelligence') return true
    const chg = item.evidence.find((e) => e.label === '24h change')?.value
    if (typeof chg === 'string') {
      const n = Number(String(chg).replace('%', '').replace('+', ''))
      return marketMaterialBand(n) !== 'quiet'
    }
    return true
  })

  const wallet = opts?.wallet?.trim()
  if (wallet && isValidSolanaWallet(wallet)) {
    try {
      const holdings = await buildHoldingsResponse(wallet)
      const summary = summaryFromHoldings(holdings)
      filtered.push(...adaptPortfolioToAttention(summary))
    } catch {
      /* holdings optional — do not fabricate */
    }
  }

  const ranked = prioritizeAttentionItems(filtered, 12)
  const prevFp = await getAttentionFingerprints()
  const nextFp: Record<string, string> = {}
  const events: Omit<AttentionLiveEvent, 'seq'>[] = []
  let newCount = 0
  let updatedCount = 0

  for (const item of ranked) {
    const fp = attentionFingerprint(item)
    nextFp[item.id] = fp
    const prev = prevFp[item.id]
    if (prev == null) {
      newCount += 1
      events.push({
        kind: 'new',
        eventType: eventTypeFor(item),
        itemId: item.id,
        at: new Date().toISOString(),
      })
    } else if (prev !== fp) {
      updatedCount += 1
      events.push({
        kind: 'updated' as AttentionChangeKind,
        eventType: eventTypeFor(item),
        itemId: item.id,
        at: new Date().toISOString(),
      })
    }
  }

  // If nothing changed, keep prior snapshot timestamps (no cosmetic rewrite)
  if (events.length === 0) {
    const existing = await getAttentionSnapshot()
    if (existing) {
      return { snapshot: existing, changed: false, newCount: 0, updatedCount: 0 }
    }
  }

  const snapshot = await saveAttentionSnapshot(ranked, nextFp, events)
  return {
    snapshot,
    changed: events.length > 0,
    newCount,
    updatedCount,
  }
}
