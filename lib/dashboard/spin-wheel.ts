/** Spin the Wheel — pure helpers (client + API). */

export const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000

export type SpinPrize = {
  id: string
  label: string
  /** Scan credits awarded (0 = no credit grant). */
  credits: number
  color: string
}

/** Fixed segments — no fabricated revenue; credits only when credits > 0. */
export const SPIN_PRIZES: SpinPrize[] = [
  { id: 'credit-1', label: '+1 Scan Credit', credits: 1, color: '#22C55E' },
  { id: 'luck', label: 'Better Luck', credits: 0, color: '#3B82F6' },
  { id: 'credit-2', label: '+2 Scan Credits', credits: 2, color: '#F97316' },
  { id: 'alpha', label: 'Alpha Tip', credits: 0, color: '#22C55E' },
  { id: 'credit-1b', label: '+1 Scan Credit', credits: 1, color: '#3B82F6' },
  { id: 'try', label: 'Try Again Tomorrow', credits: 0, color: '#F97316' },
]

export function canSpinAgain(lastSpinDate: string | null | undefined, now = Date.now()): boolean {
  if (!lastSpinDate) return true
  const t = Date.parse(lastSpinDate)
  if (!Number.isFinite(t)) return true
  return now - t >= SPIN_COOLDOWN_MS
}

export function nextSpinAt(lastSpinDate: string | null | undefined): string | null {
  if (!lastSpinDate) return null
  const t = Date.parse(lastSpinDate)
  if (!Number.isFinite(t)) return null
  return new Date(t + SPIN_COOLDOWN_MS).toISOString()
}

export function msUntilNextSpin(lastSpinDate: string | null | undefined, now = Date.now()): number {
  if (canSpinAgain(lastSpinDate, now)) return 0
  const t = Date.parse(lastSpinDate!)
  return Math.max(0, t + SPIN_COOLDOWN_MS - now)
}

/** Deterministic-ish pick from entropy (server: crypto random). */
export function pickSpinPrize(rand = Math.random()): SpinPrize {
  const i = Math.min(SPIN_PRIZES.length - 1, Math.floor(rand * SPIN_PRIZES.length))
  return SPIN_PRIZES[i]!
}

export function prizeIndex(prizeId: string): number {
  const i = SPIN_PRIZES.findIndex((p) => p.id === prizeId)
  return i >= 0 ? i : 0
}
