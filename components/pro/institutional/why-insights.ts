import type { ReasoningObject, Verdict, WeightedSecurityScore } from '@cryptocheck/types'
import { extractTopHolderPct } from '@/components/pro/institutional/model-helpers'
import type { CanonicalScanResult } from '@/lib/types/canonical-scan'

export type WhyBulletRef = { key: string; vars?: Record<string, string | number> }

export function whyBlockTitleKey(verdict: Verdict): string {
  if (verdict === 'SAFE') return 'institutional.why.title_safe'
  if (verdict === 'CAUTION') return 'institutional.why.title_caution'
  return 'institutional.why.title_high'
}

/**
 * 3–4 bullets as translation keys (with optional interpolation) derived from scan output.
 */
export function generateWhyBulletRefs(
  reasoning: ReasoningObject,
  weighted: WeightedSecurityScore,
  canonical?: CanonicalScanResult | null
): WhyBulletRef[] {
  const rb = weighted.risk_breakdown
  const top = extractTopHolderPct(reasoning)
  const hits = reasoning.clusterAnalysis.scamLinkedFundingHits
  const bullets: WhyBulletRef[] = []

  if (canonical) {
    bullets.push({
      key: 'institutional.why.bullets.liquidity_status',
      vars: { status: canonical.liquidity.status, reason: canonical.liquidity.reason },
    })
  } else if (rb.liquidity_risk < 12) {
    bullets.push({ key: 'institutional.why.bullets.liquidity_ok' })
  } else {
    bullets.push({ key: 'institutional.why.bullets.liquidity_thin' })
  }

  if (top < 28) {
    bullets.push({ key: 'institutional.why.bullets.holders_ok' })
  } else if (top < 45) {
    bullets.push({ key: 'institutional.why.bullets.holders_mid' })
  } else {
    bullets.push({ key: 'institutional.why.bullets.holders_heavy' })
  }

  if (hits === 0) {
    bullets.push({ key: 'institutional.why.bullets.scam_none' })
  } else {
    bullets.push({ key: 'institutional.why.bullets.scam_hits', vars: { count: hits } })
  }

  const mintRevoked = reasoning.evidence.some((e) => e.id === 'ev_mint_revoked')
  const mintActive = reasoning.evidence.some((e) => e.id === 'ev_mint_auth')
  if (mintRevoked) {
    bullets.push({ key: 'institutional.why.bullets.mint_fixed' })
  } else if (mintActive) {
    bullets.push({ key: 'institutional.why.bullets.mint_active' })
  }

  if (bullets.length < 3) {
    if (rb.contract_risk < 15) {
      bullets.push({ key: 'institutional.why.bullets.contract_clean' })
    } else {
      bullets.push({ key: 'institutional.why.bullets.contract_review' })
    }
  }

  return bullets.slice(0, 4)
}
