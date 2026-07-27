/**
 * Phase 18 — signed session cookie for SIWS identity.
 * Cookie name: ccai_sid. HMAC-SHA256 over payload (no JWT dependency).
 */

import 'server-only'

import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import {
  SIWS_COOKIE,
  decodeSiwsSession,
  encodeSiwsSession,
  mintSiwsSession,
  type SiwsSession,
} from '@/lib/identity/session-token'

export {
  SIWS_COOKIE,
  decodeSiwsSession,
  encodeSiwsSession,
  mintSiwsSession,
  type SiwsSession,
}

const SESSION_TTL_SEC = 60 * 60 * 24 * 30

export function attachSiwsCookie(res: NextResponse, session: SiwsSession): void {
  const token = encodeSiwsSession(session)
  res.cookies.set(SIWS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  })
}

export function clearSiwsCookie(res: NextResponse): void {
  res.cookies.set(SIWS_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export function readSiwsSessionFromRequest(req: NextRequest): SiwsSession | null {
  return decodeSiwsSession(req.cookies.get(SIWS_COOKIE)?.value)
}

export async function readSiwsSessionFromCookies(): Promise<SiwsSession | null> {
  try {
    const jar = await cookies()
    return decodeSiwsSession(jar.get(SIWS_COOKIE)?.value)
  } catch {
    return null
  }
}
