export type IngestionStats = {
  ingested: number
  dropped: number
  redisFailures: number
  floodWaits: number
  reconnects: number
  lastEventAt: string | null
  lastError: string | null
  startedAt: string
}

const stats: IngestionStats = {
  ingested: 0,
  dropped: 0,
  redisFailures: 0,
  floodWaits: 0,
  reconnects: 0,
  lastEventAt: null,
  lastError: null,
  startedAt: new Date().toISOString(),
}

export function getStats(): Readonly<IngestionStats> {
  return { ...stats }
}

export function markIngested(): void {
  stats.ingested += 1
  stats.lastEventAt = new Date().toISOString()
}

export function markDropped(reason: string): void {
  stats.dropped += 1
  stats.lastError = reason
}

export function markRedisFailure(err: string): void {
  stats.redisFailures += 1
  stats.lastError = err
}

export function markFloodWait(): void {
  stats.floodWaits += 1
}

export function markReconnect(): void {
  stats.reconnects += 1
}
