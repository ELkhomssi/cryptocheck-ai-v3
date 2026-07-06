import { createHash } from 'node:crypto'
import type { Commitment } from '@cryptocheck/signal-contracts'

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const parts = keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
  return `{${parts.join(',')}}`
}

export function hashRawPacket(rawPayload: Record<string, unknown>): string {
  const { edgeSignal: _e, ...source } = rawPayload
  return createHash('sha256').update(canonicalJson(source), 'utf8').digest('hex')
}

export function hashCommitment(commitment: Commitment): string {
  return createHash('sha256').update(canonicalJson(commitment), 'utf8').digest('hex')
}
