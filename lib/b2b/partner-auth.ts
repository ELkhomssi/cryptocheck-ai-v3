import 'server-only'

import type { NextRequest } from 'next/server'
import { verifySignature } from '@/lib/security/signing'
import { extractRawApiKey } from '@/lib/middleware/with-api-auth'

/** Resolved partner identity for B2B routes (`/api/b2b/v1/*`). */
export type PartnerContext = {
  partnerId: string
  label: string
  /** Billing band — all B2B partners run at institutional pipeline tier. */
  tier: 'institutional'
  /** How the partner was authenticated. */
  via: 'test_env' | 'partner_key'
}

export type PartnerAuthResult =
  | { ok: true; partner: PartnerContext }
  | { ok: false; status: number; code: string; message: string }

const PARTNER_SECRET_HEADER = 'x-ccai-partner-secret'

/**
 * Resolves a B2B partner from the request.
 *
 * Order:
 *  1. Test partner — `B2B_TEST_API_KEY` (+ optional `B2B_TEST_SECRET` via `X-CCAI-Partner-Secret`).
 *  2. Real partner key — `cc_partner_*` verified by HMAC against `rawBody` (when `X-CryptoCheck-Signature` sent).
 *
 * No Supabase dependency: keeps the route resilient when the partner registry table is absent.
 */
export function resolvePartnerAuth(req: NextRequest, rawBody: string): PartnerAuthResult {
  const rawKey = extractRawApiKey(req)
  if (!rawKey) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Missing partner API key. Send Authorization: Bearer <partner_key>.',
    }
  }

  const testKey = process.env.B2B_TEST_API_KEY?.trim()
  if (testKey && rawKey === testKey) {
    const expectedSecret = process.env.B2B_TEST_SECRET?.trim()
    if (expectedSecret) {
      const provided = req.headers.get(PARTNER_SECRET_HEADER)?.trim() ?? ''
      const signature = req.headers.get('x-cryptocheck-signature')?.trim()
      const ts = req.headers.get('x-cryptocheck-timestamp')?.trim() ?? ''
      const secretOk = provided.length > 0 && provided === expectedSecret
      const signatureOk =
        !!signature && verifySignature(ts, rawBody, signature, rawKey)
      if (!secretOk && !signatureOk) {
        return {
          ok: false,
          status: 401,
          code: 'PARTNER_SECRET_MISMATCH',
          message: 'Partner secret or signature required for this key.',
        }
      }
    }
    return {
      ok: true,
      partner: {
        partnerId: 'partner_test',
        label: 'Test Partner',
        tier: 'institutional',
        via: 'test_env',
      },
    }
  }

  // Real partner keys are prefixed `cc_partner_` and must carry a valid HMAC signature.
  if (rawKey.startsWith('cc_partner_')) {
    const signature = req.headers.get('x-cryptocheck-signature')?.trim()
    const ts = req.headers.get('x-cryptocheck-timestamp')?.trim() ?? ''
    if (!signature || !verifySignature(ts, rawBody, signature, rawKey)) {
      return {
        ok: false,
        status: 401,
        code: 'INVALID_SIGNATURE',
        message: 'Partner key requires a valid X-CryptoCheck-Signature.',
      }
    }
    return {
      ok: true,
      partner: {
        partnerId: `partner_${rawKey.slice(11, 19)}`,
        label: 'Registered Partner',
        tier: 'institutional',
        via: 'partner_key',
      },
    }
  }

  return {
    ok: false,
    status: 401,
    code: 'UNKNOWN_PARTNER_KEY',
    message: 'API key is not a recognized B2B partner credential.',
  }
}
