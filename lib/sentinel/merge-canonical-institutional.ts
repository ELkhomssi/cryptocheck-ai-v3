import { institutionalSafetyGrade, type ReasoningObject, type Verdict } from '@/lib/services/scanner-engine'
import type { CanonicalScanResult, CanonicalVerdict } from '@/lib/types/canonical-scan'

export function scannerVerdictFromCanonical(verdict: CanonicalVerdict): Verdict {
  if (verdict === 'AVOID') return 'CRITICAL_RISK'
  return verdict
}

export function mergeReasoningWithCanonical(reasoning: ReasoningObject, canonical: CanonicalScanResult): ReasoningObject {
  const verdict = scannerVerdictFromCanonical(canonical.verdict)
  return {
    ...reasoning,
    aggregateScore: canonical.riskScore,
    verdict,
    institutionalGrade: institutionalSafetyGrade(canonical.riskScore, verdict),
    evidence: [
      {
        id: 'ev_canonical_liquidity',
        category: 'liquidity',
        label: 'Canonical liquidity status',
        riskContribution:
          canonical.liquidity.status === 'no_pair' || canonical.liquidity.status === 'unverified' ? 35 : 5,
        maxWeight: 100,
        detail: `${canonical.liquidity.status}: ${canonical.liquidity.reason}`,
      },
      ...reasoning.evidence,
    ],
    flags: Array.from(new Set([...reasoning.flags, `CANONICAL_${canonical.verdict}`])),
  }
}
