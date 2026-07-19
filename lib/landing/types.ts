import type { ScanResult } from '@/lib/revenue-dashboard/types'

export type LandingStat = {
  value: string
  label: string
  /** Short honesty note, e.g. "last 7 days" / "as of Jul 19, 2026" */
  note: string
}

export type LandingPublicStats = {
  stats: LandingStat[]
  asOfIso: string
  asOfLabel: string
  /** Most recent presentable scan from scan_history, if any. */
  heroScan: ScanResult | null
  buildingInPublic: boolean
}
