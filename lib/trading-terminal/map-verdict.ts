import type { ScanResult } from '@/lib/revenue-dashboard/types'
import { coverageToBand } from './constants'
import type { TokenVerdictCard, TerminalVerdict } from './types'

const REQUIRED_EVIDENCE = [
  'verdict',
  'safety_score',
  'risk_score',
  'top_signals',
  'evidence_line',
] as const

/**
 * Map a gateway-backed ScanResult into the Coach TokenVerdictCard.
 * No fabricated confidence — coverage = present/required only.
 */
export function scanToVerdictCard(scan: ScanResult | null): TokenVerdictCard | null {
  if (!scan) return null

  const present: string[] = []
  if (scan.verdict) present.push('verdict')
  if (typeof scan.safetyScore === 'number') present.push('safety_score')
  if (typeof scan.riskScore === 'number') present.push('risk_score')
  if (scan.topSignals?.length) present.push('top_signals')
  if (scan.evidenceLine?.trim()) present.push('evidence_line')

  const coverage = present.length / REQUIRED_EVIDENCE.length
  const why: TokenVerdictCard['why'] = []
  const risks: TokenVerdictCard['risks'] = []

  if (scan.evidenceLine?.trim()) {
    why.push({ text: scan.evidenceLine.slice(0, 120), source: 'scan.evidenceLine' })
  }
  for (const s of scan.topSignals.slice(0, 3)) {
    const bullet = { text: `${s.label}: ${s.detail}`.slice(0, 120), source: `scan.topSignals.${s.id}` }
    if (s.weight < 0 || /risk|danger|auth|honeypot|rug|unlock/i.test(s.label)) {
      risks.push(bullet)
    } else if (why.length < 3) {
      why.push(bullet)
    }
  }

  let verdict: TerminalVerdict
  if (coverage < 0.4) {
    verdict = 'INSUFFICIENT_DATA'
  } else if (scan.verdict === 'DANGER') {
    verdict = scan.riskScore >= 80 ? 'BLOCKED' : 'HIGH_RISK'
  } else if (scan.verdict === 'CAUTION') {
    verdict = 'CAUTION'
  } else {
    verdict = 'SAFE'
  }

  return {
    mint: scan.mint,
    asOf: scan.scannedAt,
    verdict,
    evidence: {
      present,
      required: [...REQUIRED_EVIDENCE],
      coverage,
    },
    confidenceBand: coverageToBand(coverage),
    why: why.slice(0, 3),
    risks: risks.slice(0, 3),
    opportunities: [],
    scanId: `${scan.mint}:${scan.scannedAt}`,
    sample: scan.sample,
    safetyScore: scan.safetyScore,
    riskScore: scan.riskScore,
  }
}
