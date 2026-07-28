/**
 * Collective Intelligence Engine — unicorn moat layer.
 * Strictly opt-in + anonymized. Never exposes wallet, trades, or identity.
 * Event schema ready day one; UI can ship later.
 */

import type {
  CollectiveConsent,
  CollectiveSignal,
  MarketContext,
  StyleVector,
  TraderDna,
} from '../types'
import type { TlmEventBus } from './event-bus'

/** In-memory anonymized cluster store (replace with Redis ccai:tlm:collective: later) */
type AnonCluster = {
  id: string
  styleCentroid: StyleVector
  outcomes: number[]
  count: number
}

const clusters: AnonCluster[] = []

function styleDistance(a: StyleVector, b: StyleVector): number {
  let s = 0
  for (const k of Object.keys(a) as (keyof StyleVector)[]) {
    s += (a[k] - b[k]) ** 2
  }
  return Math.sqrt(s)
}

/**
 * Contribute anonymized DNA + outcome. Requires explicit consent.
 * Strips wallet / trade ids before any aggregation.
 */
export function contributeAnonymized(
  consent: CollectiveConsent,
  dna: TraderDna,
  outcomePct: number,
): boolean {
  if (!consent.optedIn) return false
  // Only style vector + outcome — no wallet, no token addresses, no timestamps of identity
  const centroid = { ...dna.styleVector }
  let best: AnonCluster | null = null
  let bestDist = Infinity
  for (const c of clusters) {
    const d = styleDistance(c.styleCentroid, centroid)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  if (best && bestDist < 0.35) {
    best.count += 1
    best.outcomes.push(outcomePct)
    // EMA update centroid
    for (const k of Object.keys(centroid) as (keyof StyleVector)[]) {
      best.styleCentroid[k] = best.styleCentroid[k] * 0.9 + centroid[k] * 0.1
    }
  } else {
    clusters.push({
      id: `cluster-${clusters.length + 1}`,
      styleCentroid: centroid,
      outcomes: [outcomePct],
      count: 1,
    })
  }
  return true
}

export function queryCollectiveSignal(
  consent: CollectiveConsent,
  dna: TraderDna | null,
  intel: MarketContext,
): CollectiveSignal | null {
  if (!consent.optedIn || !dna) return null
  if (clusters.length === 0) {
    // Seed a synthetic anonymized cluster for demo when empty — still marked anonymized
    return {
      clusterId: 'cluster-bootstrap',
      similarDnaCount: 0,
      setupLabel: `${intel.tokenSymbol} · ${intel.whaleBias} whales · ${intel.liquidityTrend} liquidity`,
      avgOutcomePct: 0,
      holdWindowLabel: 'n/a — awaiting peer sample',
      consentRequired: true,
      anonymized: true,
    }
  }

  let best: AnonCluster | null = null
  let bestDist = Infinity
  for (const c of clusters) {
    const d = styleDistance(c.styleCentroid, dna.styleVector)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  if (!best || best.count < 3 || bestDist > 0.45) return null

  const avg =
    best.outcomes.reduce((a, b) => a + b, 0) / Math.max(1, best.outcomes.length)

  return {
    clusterId: best.id,
    similarDnaCount: best.count,
    setupLabel: `${intel.whaleBias} + ${intel.liquidityTrend} liquidity setups`,
    avgOutcomePct: Number(avg.toFixed(1)),
    holdWindowLabel: dna.styleVector.scalper > 0.3 ? '~1–4h' : '~2–12h',
    consentRequired: true,
    anonymized: true,
  }
}

export class CollectiveIntelligenceEngine {
  private consent: CollectiveConsent = { optedIn: false, updatedAt: new Date().toISOString() }

  constructor(private readonly bus: TlmEventBus) {}

  getConsent() {
    return { ...this.consent }
  }

  setConsent(optedIn: boolean) {
    this.consent = { optedIn, updatedAt: new Date().toISOString() }
    return this.consent
  }

  contribute(dna: TraderDna, outcomePct: number) {
    return contributeAnonymized(this.consent, dna, outcomePct)
  }

  signal(dna: TraderDna | null, intel: MarketContext): CollectiveSignal | null {
    const sig = queryCollectiveSignal(this.consent, dna, intel)
    if (sig && sig.similarDnaCount > 0) {
      this.bus.publish('CollectiveSignalReady', { clusterId: sig.clusterId, n: sig.similarDnaCount }, 'CollectiveIntelligenceEngine')
    }
    return sig
  }
}

/** Test helper — clear in-memory clusters */
export function __resetCollectiveClustersForTests() {
  clusters.length = 0
}
