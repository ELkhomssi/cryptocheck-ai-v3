import { Redis } from '@upstash/redis'
import type { RawMessage } from '@cryptocheck/signal-contracts'
import { SIGNAL_STREAM_RAW } from '@cryptocheck/signal-contracts'
import { markIngested, markRedisFailure } from './stats.js'

export type RawStreamWriter = {
  xaddRaw(message: RawMessage): Promise<string | null>
  streamKey: string
}

export function createRawStreamWriter(maxLen: number): RawStreamWriter {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required')
  }

  const client = new Redis({ url, token })

  return {
    streamKey: SIGNAL_STREAM_RAW,
    async xaddRaw(message: RawMessage): Promise<string | null> {
      try {
        const id = await client.xadd(
          SIGNAL_STREAM_RAW,
          '*',
          { data: JSON.stringify(message) },
          maxLen > 0
            ? {
                trim: { type: 'MAXLEN', comparison: '~', threshold: maxLen },
              }
            : undefined,
        )
        markIngested()
        return id
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'xadd failed'
        markRedisFailure(msg)
        throw e
      }
    },
  }
}
