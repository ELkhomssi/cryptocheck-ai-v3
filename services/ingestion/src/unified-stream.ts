import { Redis } from '@upstash/redis'
import {
  SIGNAL_DEDUP_ID_PREFIX,
  SIGNAL_LATENCY_CONTRACT,
  SIGNAL_STREAM_UNIFIED,
  SIGNAL_UNIFIED_STREAM_FIELD,
  signalSourceStreamKey,
  type SourceTag,
  type UnifiedSignal,
} from '@cryptocheck/signal-contracts'
import { markDropped, markIngested, markRedisFailure } from './stats.js'

export type UnifiedStreamWriter = {
  xaddUnified(signal: UnifiedSignal): Promise<string | null>
  unifiedStreamKey: string
  sourceStreamKey: string
}

export function createUnifiedStreamWriter(
  sourceTag: SourceTag,
  maxLen: number,
): UnifiedStreamWriter {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required')
  }

  const client = new Redis({ url, token })
  const sourceStreamKey = signalSourceStreamKey(sourceTag)
  const dedupTtlSec = SIGNAL_LATENCY_CONTRACT.dedupWindowSec
  const trim =
    maxLen > 0
      ? ({ trim: { type: 'MAXLEN' as const, comparison: '~' as const, threshold: maxLen } } as const)
      : undefined

  return {
    unifiedStreamKey: SIGNAL_STREAM_UNIFIED,
    sourceStreamKey,
    async xaddUnified(signal: UnifiedSignal): Promise<string | null> {
      try {
        const dedupKey = `${SIGNAL_DEDUP_ID_PREFIX}${signal.id}`
        const acquired = await client.set(dedupKey, '1', { nx: true, ex: dedupTtlSec })
        if (acquired !== 'OK') {
          markDropped(`dedup:${signal.id}`)
          return null
        }

        const payload = { [SIGNAL_UNIFIED_STREAM_FIELD]: JSON.stringify(signal) }

        await client.xadd(sourceStreamKey, '*', payload, trim)
        const id = await client.xadd(SIGNAL_STREAM_UNIFIED, '*', payload, trim)
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
