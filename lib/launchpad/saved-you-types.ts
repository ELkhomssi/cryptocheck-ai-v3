/** Client-safe Saved-You types (no server-only). */

export type SavedYouRow = {
  id: string
  blockId: string
  userId: string | null
  mint: string
  symbol: string | null
  blockedAt: string
  gradedAt: string
  priceAtBlock: number | null
  priceAtGrade: number | null
  drawdownPct: number | null
  /** Estimate only — labeled in UI. */
  lossAvoidedEstimate: number | null
  outcomeEvidence: string
  explorerUrl: string | null
}

export type UserBlockOutcome = 'pending' | 'rugged' | 'survived' | 'expired'
