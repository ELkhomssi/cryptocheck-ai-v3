import type { CoachVerdict } from './constants'

const SEVERITY: Record<CoachVerdict, number> = { SAFE: 0, CAUTION: 1, DANGER: 2 }

export function normalizeCoachVerdict(raw: string | null | undefined): CoachVerdict {
  const v = (raw ?? '').toUpperCase().replace(/\s+/g, '_')
  if (v === 'SAFE' || v === 'LOW_RISK') return 'SAFE'
  if (v === 'CAUTION' || v === 'MODERATE') return 'CAUTION'
  return 'DANGER'
}

export function isVerdictDegrade(prev: CoachVerdict, next: CoachVerdict): boolean {
  return SEVERITY[next] > SEVERITY[prev]
}

const FACTOR_DEGRADE_RE =
  /mint[_\s-]?author.*(?:active|re-?activ)|freeze[_\s-]?author.*(?:active|re-?activ)|lp[_\s-]?unlock|liquidity\s*(?:remov|unlock)|holder\s*concentr|top\s*1[0]?\s*%|cluster(?:ed)?\s*holder/i

/**
 * Detect degradation: verdict step-down OR named risk factor newly present.
 * Pure function — unit-tested for cost-control and alert correctness.
 */
export function detectDegrade(input: {
  prevVerdict: CoachVerdict
  newVerdict: CoachVerdict
  prevLabels: string[]
  newLabels: string[]
  prevEvidenceLine?: string | null
  newEvidenceLine?: string | null
}): { degraded: boolean; reason: string } {
  if (isVerdictDegrade(input.prevVerdict, input.newVerdict)) {
    return {
      degraded: true,
      reason: `Verdict ${input.prevVerdict} → ${input.newVerdict}`,
    }
  }

  const prevBlob = [...input.prevLabels, input.prevEvidenceLine ?? ''].join(' · ')
  const newBlob = [...input.newLabels, input.newEvidenceLine ?? ''].join(' · ')
  const prevHad = FACTOR_DEGRADE_RE.test(prevBlob)
  const nowHas = FACTOR_DEGRADE_RE.test(newBlob)
  if (!prevHad && nowHas) {
    const hit = input.newLabels.find((l) => FACTOR_DEGRADE_RE.test(l))
    return {
      degraded: true,
      reason: hit
        ? `New risk factor: ${hit}`
        : 'New structural risk factor in scan evidence (mint/LP/concentration)',
    }
  }

  return { degraded: false, reason: '' }
}

/**
 * Deduplicate mint→users map keys. Cost scales with unique mint count.
 * Exported for tests: N users × same mint → 1 mint entry.
 */
export function uniqueMintCount(mintToUsers: Map<string, Set<string>>): number {
  return mintToUsers.size
}
