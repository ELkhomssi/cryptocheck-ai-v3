/**
 * Multi-source merge for unified token signals.
 * Same chain+CA within the dedup window shares one logical id and accumulates sources[].
 * Enables free-tier filter (sourceCount >= 2) once two channels mention the same mint.
 */
import { SIGNAL_LATENCY_CONTRACT, type UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'

const MERGE_PREFIX = 'ccai:sig:merge:ca:'

type MergeRecord = {
  id: string
  sources: string[]
  sourceCount: number
}

function mergeKey(chain: string, ca: string): string {
  return `${MERGE_PREFIX}${chain}:${ca.toLowerCase()}`
}

export async function mergeTokenSources(
  redis: Redis,
  signal: UnifiedSignal,
): Promise<UnifiedSignal> {
  if (signal.subjectType !== 'token') return signal
  const chain = signal.chain
  const ca = signal.contractAddress?.trim()
  if (!chain || !ca) return signal

  const key = mergeKey(chain, ca)
  const ttl = SIGNAL_LATENCY_CONTRACT.dedupWindowSec
  const existingRaw = await redis.get<string>(key)

  let record: MergeRecord | null = null
  if (existingRaw) {
    try {
      record = typeof existingRaw === 'string' ? (JSON.parse(existingRaw) as MergeRecord) : (existingRaw as MergeRecord)
    } catch {
      record = null
    }
  }

  const incoming = signal.sources?.length ? signal.sources : [signal.sourceTag]
  const sources = new Set(record?.sources ?? [])
  for (const s of incoming) sources.add(s)

  const next: MergeRecord = {
    id: record?.id ?? signal.id,
    sources: [...sources],
    sourceCount: sources.size,
  }

  await redis.set(key, JSON.stringify(next), { ex: ttl })

  return {
    ...signal,
    id: next.id,
    sources: next.sources,
    sourceCount: next.sourceCount,
  }
}
