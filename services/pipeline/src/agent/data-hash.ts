import { createHash } from 'node:crypto'

/** Stable JSON for hashing — sorted keys, no undefined. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const parts = keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
  return `{${parts.join(',')}}`
}

/** Hash the raw TxODDS packet that triggered a decision (Prompt C verify path). */
export function hashRawPacket(rawPayload: Record<string, unknown>): string {
  // Strip evaluator output so hash is source-data only
  const { edgeSignal: _e, ...source } = rawPayload
  return createHash('sha256').update(canonicalJson(source), 'utf8').digest('hex')
}

export function hashSettlementInputs(input: {
  decisionId: string
  outcome: string
  realizedPnl: number
  finalScore?: { home: number; away: number }
}): string {
  return createHash('sha256').update(canonicalJson(input), 'utf8').digest('hex')
}
