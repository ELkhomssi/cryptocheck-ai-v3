export type EnrichStats = {
  processed: number
  publishedNew: number
  publishedUpdate: number
  removed: number
  dropped: number
  errors: number
  startedAt: string
}

const stats: EnrichStats = {
  processed: 0,
  publishedNew: 0,
  publishedUpdate: 0,
  removed: 0,
  dropped: 0,
  errors: 0,
  startedAt: new Date().toISOString(),
}

export function getEnrichStats(): Readonly<EnrichStats> {
  return { ...stats }
}

export function markProcessed(): void {
  stats.processed += 1
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
