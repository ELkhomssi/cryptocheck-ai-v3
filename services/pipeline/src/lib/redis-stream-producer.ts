import { SIGNAL_STREAM_PARSED } from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'
import type { ParsedStreamEntry } from '@cryptocheck/signal-contracts'

export async function writeParsedEntry(redis: Redis, entry: ParsedStreamEntry): Promise<string | null> {
  return redis.xadd(SIGNAL_STREAM_PARSED, '*', { data: JSON.stringify(entry) })
}
