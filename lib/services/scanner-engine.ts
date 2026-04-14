import { KNOWN_RUGPULL_FINGERPRINTS, type RugpullFingerprint } from '@/lib/data/known-rugpull-fingerprints'

/** Single weighted line of evidence (white-box). */
export type EvidenceLine = {
  id: string
  category: 'liquidity' | 'authority' | 'distribution' | 'behavior' | 'fingerprint' | 'cluster'
  label: string
  /** Points toward risk: positive = increases risk (reduces safety score contribution). */
  riskContribution: number
  /** Max magnitude this line could apply (for transparency). */
  maxWeight: number
  detail: string
}

export type FingerprintMatchResult = {
  fingerprint: RugpullFingerprint
  similarity: number
  matchedSignals: string[]
  weightedScore: number
}

export type ReasoningObject = {
  /** 0–100 safety-oriented score (higher = safer). */
  aggregateScore: number
  /** 0–100 how complete / reliable the underlying inputs were. */
  confidenceScore: number
  verdict: 'SAFE' | 'CAUTION' | 'HIGH_RISK'
  evidence: EvidenceLine[]
  /** Named flags for dashboards & API consumers. */
  flags: string[]
  fingerprintBestMatch: FingerprintMatchResult | null
  /** Placeholder: linked-wallet / scam-funding analysis (expand with graph DB). */
  clusterAnalysis: {
    linkedCreatorRisk: 'low' | 'medium' | 'high'
    summary: string
    scamLinkedFundingHits: number
  }
}

export type ScannerEngineInput = {
  mint: string
  /** Rough USD liquidity from DEX APIs. */
  liquidityUsd?: number | null
  /** Top holder % of supply (0–100). */
  topHolderPct?: number | null
  /** Pool / pair age in minutes. */
  pairAgeMinutes?: number | null
  /** Mint authority still set? */
  mintAuthorityActive?: boolean | null
  /** Creator / deployer wallet (base58). */
  creatorWallet?: string | null
  /**
   * Placeholder: count of historical transfers to known-scam-labeled addresses
   * funded by the creator wallet (filled by future indexer).
   */
  creatorScamLinkedFundingCount?: number
  /** Extra boolean signals for fingerprint overlap. */
  signals?: Partial<{
    suspicious_router: boolean
    low_dex_verification: boolean
    extreme_tax_or_blacklist: boolean
    metadata_update_churn: boolean
    duplicate_symbol: boolean
    proxy_mint: boolean
    mixer_funding_trail: boolean
  }>
}

const MAX_START = 100

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function verdictFromScore(s: number): ReasoningObject['verdict'] {
  if (s >= 72) return 'SAFE'
  if (s >= 45) return 'CAUTION'
  return 'HIGH_RISK'
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

/**
 * Derive abstract "deployment signals" from numeric + boolean inputs for fingerprint overlap.
 */
function deriveTokenSignals(input: ScannerEngineInput): Set<string> {
  const s = new Set<string>()
  const liq = input.liquidityUsd ?? 0
  const top = input.topHolderPct ?? 0
  const age = input.pairAgeMinutes ?? 1e9

  if (liq < 25_000) s.add('thin_liquidity')
  if (age < 120) s.add('fresh_pool')
  if (top > 35) s.add('high_creator_allocation')
  if (input.mintAuthorityActive) s.add('mint_authority_retained')

  const sig = input.signals
  if (sig?.suspicious_router) s.add('suspicious_router')
  if (sig?.low_dex_verification) s.add('low_dex_verification')
  if (sig?.extreme_tax_or_blacklist) s.add('extreme_tax_or_blacklist')
  if (sig?.metadata_update_churn) s.add('metadata_update_churn')
  if (sig?.duplicate_symbol) s.add('duplicate_symbol')
  if (sig?.proxy_mint) s.add('proxy_mint')
  if (sig?.mixer_funding_trail) s.add('mixer_funding_trail')

  const hits = input.creatorScamLinkedFundingCount ?? 0
  if (hits >= 2) {
    s.add('behavioral_scam_links')
    s.add('linked_creator_cluster')
  }

  return s
}

function matchFingerprints(tokenSignals: Set<string>): FingerprintMatchResult | null {
  let best: FingerprintMatchResult | null = null

  for (const fp of KNOWN_RUGPULL_FINGERPRINTS) {
    const fpSet = new Set(fp.signals)
    const sim = jaccardSimilarity(tokenSignals, fpSet)
    const matched = [...tokenSignals].filter((x) => fpSet.has(x))
    const weighted = sim * fp.baseWeight
    if (!best || weighted > best.weightedScore) {
      best = {
        fingerprint: fp,
        similarity: clamp(sim, 0, 1),
        matchedSignals: matched,
        weightedScore: weighted,
      }
    }
  }

  return best
}

/**
 * Placeholder: if creator historically funded addresses later flagged in scam clusters,
 * escalate behavioral risk (integrate with Wallet Graph / TRM later).
 */
export function evaluateLinkedCreatorWallets(input: {
  creatorWallet?: string | null
  scamLinkedFundingCount?: number
}): { risk: 'low' | 'medium' | 'high'; flagBehavioralPattern: boolean; detail: string } {
  const w = input.creatorWallet
  const n = input.scamLinkedFundingCount ?? 0
  if (!w) {
    return {
      risk: 'low',
      flagBehavioralPattern: false,
      detail: 'Creator wallet unknown — cluster risk not evaluated.',
    }
  }
  if (n >= 3) {
    return {
      risk: 'high',
      flagBehavioralPattern: true,
      detail: `Creator wallet shows ${n} outbound links to scam-tagged counterparties (indexed).`,
    }
  }
  if (n >= 1) {
    return {
      risk: 'medium',
      flagBehavioralPattern: true,
      detail: `Creator wallet shows ${n} scam-linked funding touchpoint(s) — monitor cluster inflows.`,
    }
  }
  return {
    risk: 'low',
    flagBehavioralPattern: false,
    detail: 'No scam-linked funding pattern detected in placeholder indexer.',
  }
}

export class ScannerEngine {
  /**
   * Core explainable pass: weighted evidence lines + fingerprint similarity + cluster placeholder.
   */
  static analyze(input: ScannerEngineInput): ReasoningObject {
    const evidence: EvidenceLine[] = []
    const flags: string[] = []
    let score = MAX_START

    const liq = input.liquidityUsd
    if (liq != null) {
      const maxW = 18
      let risk = 0
      let detail = ''
      if (liq < 10_000) {
        risk = 16
        detail = `Liquidity ~$${liq.toFixed(0)} — very thin book; slippage and exit risk elevated.`
      } else if (liq < 50_000) {
        risk = 10
        detail = `Liquidity ~$${liq.toFixed(0)} — below typical institutional comfort band.`
      } else if (liq < 150_000) {
        risk = 4
        detail = `Liquidity ~$${liq.toFixed(0)} — moderate; still monitor depth.`
      } else {
        risk = 0
        detail = `Liquidity ~$${liq.toFixed(0)} — depth reduces manipulation surface vs micro-caps.`
      }
      const rc = clamp(risk, 0, maxW)
      score -= rc
      evidence.push({
        id: 'ev_liquidity',
        category: 'liquidity',
        label: 'Liquidity depth',
        riskContribution: rc,
        maxWeight: maxW,
        detail,
      })
    } else {
      flags.push('missing_liquidity')
      evidence.push({
        id: 'ev_liquidity_unknown',
        category: 'liquidity',
        label: 'Liquidity depth',
        riskContribution: 6,
        maxWeight: 18,
        detail: 'Liquidity not available — confidence reduced; assume elevated execution risk.',
      })
      score -= 6
    }

    const top = input.topHolderPct
    if (top != null) {
      const maxW = 22
      let risk = 0
      if (top > 50) risk = 20
      else if (top > 35) risk = 14
      else if (top > 25) risk = 8
      else risk = 2
      const rc = clamp(risk, 0, maxW)
      score -= rc
      evidence.push({
        id: 'ev_concentration',
        category: 'distribution',
        label: 'Holder concentration',
        riskContribution: rc,
        maxWeight: maxW,
        detail: `Top holder ~${top.toFixed(1)}% of supply — ${top > 35 ? 'severe' : 'notable'} insider concentration.`,
      })
    } else {
      flags.push('missing_holder_curve')
      score -= 5
      evidence.push({
        id: 'ev_holders_unknown',
        category: 'distribution',
        label: 'Holder concentration',
        riskContribution: 5,
        maxWeight: 22,
        detail: 'Holder distribution unknown — cannot rule out hidden whale cartels.',
      })
    }

    const age = input.pairAgeMinutes
    if (age != null) {
      const maxW = 12
      let risk = 0
      if (age < 30) risk = 10
      else if (age < 180) risk = 6
      else if (age < 1440) risk = 3
      const rc = clamp(risk, 0, maxW)
      score -= rc
      evidence.push({
        id: 'ev_pool_age',
        category: 'liquidity',
        label: 'Pool age',
        riskContribution: rc,
        maxWeight: maxW,
        detail:
          age < 60
            ? `Pool age ~${age}m — extremely fresh; common in predatory launches.`
            : `Pool age ~${Math.round(age / 60)}h — ${age < 180 ? 'still young' : 'established enough for baseline TA'}.`,
      })
    }

    if (input.mintAuthorityActive === true) {
      const maxW = 15
      const rc = 12
      score -= rc
      evidence.push({
        id: 'ev_mint_auth',
        category: 'authority',
        label: 'Mint authority',
        riskContribution: rc,
        maxWeight: maxW,
        detail: 'Mint authority not renounced — supply can still be inflated.',
      })
      flags.push('mint_authority_active')
    } else if (input.mintAuthorityActive === false) {
      evidence.push({
        id: 'ev_mint_revoked',
        category: 'authority',
        label: 'Mint authority',
        riskContribution: 0,
        maxWeight: 15,
        detail: 'Mint authority appears renounced or fixed-supply — reduces inflation rug vector.',
      })
    }

    const cluster = evaluateLinkedCreatorWallets({
      creatorWallet: input.creatorWallet,
      scamLinkedFundingCount: input.creatorScamLinkedFundingCount,
    })

    if (cluster.flagBehavioralPattern) {
      const maxW = 25
      const rc = cluster.risk === 'high' ? 22 : 14
      score -= rc
      evidence.push({
        id: 'ev_creator_cluster',
        category: 'cluster',
        label: 'High Risk: Behavioral Pattern',
        riskContribution: rc,
        maxWeight: maxW,
        detail: cluster.detail,
      })
      flags.push('HIGH_RISK_BEHAVIORAL_PATTERN')
    } else {
      evidence.push({
        id: 'ev_creator_cluster',
        category: 'cluster',
        label: 'Linked creator wallets',
        riskContribution: 0,
        maxWeight: 25,
        detail: cluster.detail,
      })
    }

    const tokenSignals = deriveTokenSignals(input)
    const fpMatch = matchFingerprints(tokenSignals)

    if (fpMatch && fpMatch.similarity > 0.2) {
      const maxW = 20
      const rc = clamp(Math.round(fpMatch.weightedScore * maxW), 4, maxW)
      score -= rc
      evidence.push({
        id: 'ev_fingerprint',
        category: 'fingerprint',
        label: `Fingerprint: ${fpMatch.fingerprint.label}`,
        riskContribution: rc,
        maxWeight: maxW,
        detail: `${fpMatch.fingerprint.description} Overlap: ${fpMatch.matchedSignals.slice(0, 6).join(', ') || 'pattern proximity'}. Similarity ${(fpMatch.similarity * 100).toFixed(1)}%.`,
      })
      flags.push(`fingerprint:${fpMatch.fingerprint.id}`)
    }

    score = clamp(score, 0, 100)

    let confidence = 72
    if (liq == null) confidence -= 10
    if (top == null) confidence -= 8
    if (age == null) confidence -= 5
    if (!input.creatorWallet) confidence -= 6
    confidence = clamp(confidence, 18, 100)

    return {
      aggregateScore: Math.round(score),
      confidenceScore: confidence,
      verdict: verdictFromScore(score),
      evidence,
      flags,
      fingerprintBestMatch: fpMatch,
      clusterAnalysis: {
        linkedCreatorRisk: cluster.risk,
        summary: cluster.detail,
        scamLinkedFundingHits: input.creatorScamLinkedFundingCount ?? 0,
      },
    }
  }
}
