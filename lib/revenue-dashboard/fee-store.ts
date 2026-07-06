import 'server-only'

import { randomUUID } from 'crypto'
import { redis } from '@/lib/cache/redis'
import type { FeeRecord } from './types'

const INDEX_KEY = 'ccai:rev:fee:index'
const RECORD_TTL_SEC = 60 * 60 * 24 * 365

/** Persist a fee row only after a confirmed on-chain swap. */
export async function recordFeeRecord(record: Omit<FeeRecord, 'id'> & { id?: string }): Promise<FeeRecord> {
  const full: FeeRecord = { ...record, id: record.id ?? `fee_${randomUUID()}` }
  try {
    await redis.setex(`ccai:rev:fee:${full.id}`, RECORD_TTL_SEC, JSON.stringify(full))
    const raw = await redis.get(INDEX_KEY)
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : []
    const next = [full.id, ...ids.filter((x) => x !== full.id)].slice(0, 2000)
    await redis.setex(INDEX_KEY, RECORD_TTL_SEC, JSON.stringify(next))
  } catch {
    /* best-effort — revenue tile may lag */
  }
  return full
}

export async function listFeeRecords(limit = 50): Promise<FeeRecord[]> {
  try {
    const raw = await redis.get(INDEX_KEY)
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : []
    const rows = await Promise.all(
      ids.slice(0, limit).map(async (id) => {
        const row = await redis.get(`ccai:rev:fee:${id}`)
        return row ? (JSON.parse(row) as FeeRecord) : null
      }),
    )
    return rows.filter((r): r is FeeRecord => r != null)
  } catch {
    return []
  }
}

export async function aggregateFeesUsd(): Promise<{ totalUsd: number; swapCount: number }> {
  const records = await listFeeRecords(500)
  let totalUsd = 0
  for (const r of records) {
    if (typeof r.feeAmountUsd === 'number' && r.feeAmountUsd > 0) {
      totalUsd += r.feeAmountUsd
    }
  }
  return { totalUsd, swapCount: records.length }
}
