/**
 * Phase 18 — resolve SIWS session → stable user_id at the API boundary.
 * Wallet is still needed for on-chain portfolio reads; memory/reports use userId.
 */

import 'server-only'

import type { NextRequest } from 'next/server'
import { readSiwsSessionFromRequest, type SiwsSession } from '@/lib/identity/session'
import { resolveUserIdFromWallet } from '@/lib/identity/siws'

export type IdentityContext = {
  userId: string | null
  walletAddress: string | null
  session: SiwsSession | null
  /** True when identity came from verified SIWS cookie. */
  authenticated: boolean
}

/**
 * Prefer SIWS session. Fall back to ?wallet= / body wallet for read-only legacy
 * callers — but do not invent a user_id without a verified session.
 */
export function resolveIdentityFromRequest(
  req: NextRequest,
  opts?: { walletParam?: string | null },
): IdentityContext {
  const session = readSiwsSessionFromRequest(req)
  if (session) {
    return {
      userId: session.userId,
      walletAddress: session.wallet,
      session,
      authenticated: true,
    }
  }
  const wallet =
    (opts?.walletParam || req.nextUrl.searchParams.get('wallet') || '').trim() || null
  return {
    userId: null,
    walletAddress: wallet,
    session: null,
    authenticated: false,
  }
}

/** Async resolve: if only wallet provided, look up linked user_id (no invent). */
export async function resolveIdentityWithLookup(
  req: NextRequest,
  opts?: { walletParam?: string | null },
): Promise<IdentityContext> {
  const base = resolveIdentityFromRequest(req, opts)
  if (base.userId) return base
  if (!base.walletAddress) return base
  const userId = await resolveUserIdFromWallet(base.walletAddress)
  return {
    ...base,
    userId,
    authenticated: false,
  }
}
