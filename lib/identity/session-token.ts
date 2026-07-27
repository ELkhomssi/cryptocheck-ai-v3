/**
 * Phase 18 — pure SIWS session token encode/decode (no Next cookies).
 */

import { createHmac, timingSafeEqual } from 'crypto'

export const SIWS_COOKIE = 'ccai_sid'
const SESSION_TTL_SEC = 60 * 60 * 24 * 30 // 30d

export type SiwsSession = {
  userId: string
  wallet: string
  iat: number
  exp: number
}

function sessionSecret(): string {
  const s =
    process.env.SIWS_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  if (!s) throw new Error('SIWS_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) required')
  return s
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf
  return b.toString('base64url')
}

function signPayload(payloadB64: string): string {
  return createHmac('sha256', sessionSecret()).update(payloadB64).digest('base64url')
}

export function encodeSiwsSession(session: SiwsSession): string {
  const payloadB64 = b64url(JSON.stringify(session))
  const sig = signPayload(payloadB64)
  return `${payloadB64}.${sig}`
}

export function decodeSiwsSession(token: string | undefined | null): SiwsSession | null {
  if (!token || !token.includes('.')) return null
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return null
  const expected = signPayload(payloadB64)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const json = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SiwsSession
    if (!json.userId || !json.wallet || !json.exp) return null
    if (json.exp * 1000 < Date.now()) return null
    return json
  } catch {
    return null
  }
}

export function mintSiwsSession(userId: string, wallet: string): SiwsSession {
  const iat = Math.floor(Date.now() / 1000)
  return { userId, wallet, iat, exp: iat + SESSION_TTL_SEC }
}
