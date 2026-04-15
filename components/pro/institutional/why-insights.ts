import type { ReasoningObject, Verdict } from '@/lib/services/scanner-engine'
import type { WeightedSecurityScore } from '@/lib/services/scanner/types'
import { extractTopHolderPct } from '@/components/pro/institutional/model-helpers'

export function whyBlockTitle(verdict: Verdict): string {
  if (verdict === 'SAFE') return 'Why this is safe'
  if (verdict === 'CAUTION') return "Why we're cautious"
  return 'Why this is high risk'
}

/**
 * 3–4 plain-English bullets derived from scan output (no new backend fields).
 */
export function generateWhyBullets(reasoning: ReasoningObject, weighted: WeightedSecurityScore): string[] {
  const rb = weighted.risk_breakdown
  const top = extractTopHolderPct(reasoning)
  const hits = reasoning.clusterAnalysis.scamLinkedFundingHits
  const bullets: string[] = []

  if (rb.liquidity_risk < 12) {
    bullets.push('Strong liquidity depth lowers manipulation and exit risk.')
  } else if (rb.liquidity_risk < 28) {
    bullets.push('Liquidity is acceptable but large orders may move the market.')
  } else {
    bullets.push('Thin liquidity raises execution risk — size carefully.')
  }

  if (top < 28) {
    bullets.push('No extreme top-holder concentration in this model view.')
  } else if (top < 45) {
    bullets.push('Meaningful supply sits with top wallets — watch distribution shifts.')
  } else {
    bullets.push('Heavy concentration among top wallets — insider risk is material.')
  }

  if (hits === 0) {
    bullets.push('No suspicious wallet cluster ties flagged for this creator.')
  } else {
    bullets.push(`Linked counterparties with scam history: ${hits} — treat as elevated behavioral risk.`)
  }

  const mintRevoked = reasoning.evidence.some((e) => e.id === 'ev_mint_revoked')
  const mintActive = reasoning.evidence.some((e) => e.id === 'ev_mint_auth')
  if (mintRevoked) {
    bullets.push('Supply rules look fixed — no active mint lever in this assessment.')
  } else if (mintActive) {
    bullets.push('Mint control may still be active — supply can change.')
  }

  if (bullets.length < 3) {
    if (rb.contract_risk < 15) {
      bullets.push('Contract and pattern signals look clean versus known exploit fingerprints.')
    } else {
      bullets.push('Contract or pattern signals warrant extra review before sizing up.')
    }
  }

  return bullets.slice(0, 4)
}
