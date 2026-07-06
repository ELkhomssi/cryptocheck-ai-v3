export type ParserStats = {
  processed: number
  emitted: number
  removed: number
  skipped: number
  errors: number
  llmCalls: number
  startedAt: string
}

const stats: ParserStats = {
  processed: 0,
  emitted: 0,
  removed: 0,
  skipped: 0,
  errors: 0,
  llmCalls: 0,
  startedAt: new Date().toISOString(),
}

export function getParserStats(): Readonly<ParserStats> {
  return { ...stats }
}

export function markProcessed(): void {
  stats.processed += 1
}
export function markEmitted(): void {
  stats.emitted += 1
}
export function markRemoved(): void {
  stats.removed += 1
}
export function markSkipped(): void {
  stats.skipped += 1
}
export function markError(): void {
  stats.errors += 1
}
export function markLlm(): void {
  stats.llmCalls += 1
}
