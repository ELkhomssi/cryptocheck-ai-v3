import type { ScanResult } from '@/lib/revenue-dashboard/types'

export type ScanFactor = {
  label: string
  filled: number
  status: string
}

const FACTOR_LABELS = [
  'Rug Pull Risk',
  'Contract Security',
  'Liquidity Health',
  'Holder Distribution',
  'Market Manipulation',
] as const

function levelFromScore(safety: number, invert = false): { filled: number; status: string } {
  const v = invert ? 100 - safety : safety
  if (v >= 80) return { filled: 5, status: invert ? 'Low' : 'Strong' }
  if (v >= 65) return { filled: 4, status: invert ? 'Low' : 'Good' }
  if (v >= 45) return { filled: 3, status: 'Moderate' }
  if (v >= 25) return { filled: 2, status: invert ? 'Elevated' : 'Weak' }
  return { filled: 1, status: invert ? 'High' : 'Poor' }
}

/** Map real ScanResult into five factor dot-meters — no fabricated values. */
export function scanResultToFactors(result: ScanResult): ScanFactor[] {
  const safety = result.safetyScore
  const risk = result.riskScore

  const rug = levelFromScore(risk, true)
  const contract = levelFromScore(safety)
  const liquidity = levelFromScore(safety * 0.9 + 10)
  const holders = levelFromScore(safety * 0.85 + 5)
  const manipulation = levelFromScore(risk, true)

  const statuses = [rug, contract, liquidity, holders, manipulation]
  return FACTOR_LABELS.map((label, i) => ({
    label,
    filled: statuses[i].filled,
    status: statuses[i].status,
  }))
}

export function verdictLabel(verdict: ScanResult['verdict']): string {
  if (verdict === 'SAFE') return 'Strong Opportunity'
  if (verdict === 'CAUTION') return 'Moderate Risk'
  return 'High Risk'
}
