/**
 * Decision / settlement signatures — reuse @cryptocheck/signing HMAC primitives.
 * Non-custodial: signs commitment metadata only; never holds user funds or keys.
 */
import {
  buildRequestSignature,
  DEV_SIGNING_SALT_FALLBACK,
  verifySignature,
} from '@cryptocheck/signing'
import { canonicalJson } from './data-hash.js'

function agentKeyMaterial(): { key: string; salt: string } | null {
  const key =
    process.env.SIGNAL_AGENT_SIGNING_KEY?.trim() ||
    process.env.SIGNAL_WORKER_SECRET?.trim() ||
    ''
  if (!key) return null
  const salt =
    process.env.SIGNAL_AGENT_SIGNING_SALT?.trim() ||
    process.env.API_SIGNING_SALT?.trim() ||
    DEV_SIGNING_SALT_FALLBACK
  return { key, salt }
}

export function signCommitment(payload: Record<string, unknown>): {
  signature: string
  signedAt: string
} | null {
  const mat = agentKeyMaterial()
  if (!mat) return null
  const signedAt = String(Math.floor(Date.now() / 1000))
  const body = canonicalJson(payload)
  const signature = buildRequestSignature(signedAt, body, mat.key, mat.salt, 'hex')
  return { signature, signedAt }
}

export function verifyCommitment(
  payload: Record<string, unknown>,
  signature: string,
  signedAt: string,
): boolean {
  const mat = agentKeyMaterial()
  if (!mat) return false
  return verifySignature(signedAt, canonicalJson(payload), signature, mat.key, mat.salt)
}
