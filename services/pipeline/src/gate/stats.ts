export type GateStats = {
  processed: number
  tokenAssessed: number
  sportsEvaluated: number
  publishedNew: number
  publishedUpdate: number
  removed: number
  dropped: number
  errors: number
  startedAt: string
}

const stats: GateStats = {
  processed: 0,
  tokenAssessed: 0,
  sportsEvaluated: 0,
  publishedNew: 0,
  publishedUpdate: 0,
  removed: 0,
  dropped: 0,
  errors: 0,
  startedAt: new Date().toISOString(),
}

export function getGateStats(): Readonly<GateStats> {
  return { ...stats }
}

export function markProcessed(): void {
  stats.processed += 1
}
export function markTokenAssessed(): void {
  stats.tokenAssessed += 1
}
export function markSportsEvaluated(): void {
  stats.sportsEvaluated += 1
}
export function markPublishedNew(): void {
  stats.publishedNew += 1
}
export function markPublishedUpdate(): void {
  stats.publishedUpdate += 1
}
export function markRemoved(): void {
  stats.removed += 1
}
export function markDropped(): void {
  stats.dropped += 1
}
export function markError(): void {
  stats.errors += 1
}
