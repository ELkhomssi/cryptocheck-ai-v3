import 'server-only'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { computeBotScore, headerAnomalyFromHeaders, resolveConfig } from '@/lib/bot-protection/score'
import { isSearchEngineCrawler } from '@/lib/bot-protection/allowlists'
import { pickClientIp } from '@/lib/page-views/capture'

const NONCE_HEADER = 'x-cryptocheck-nonce'
const TIMESTAMP_HEADER = 'x-cryptocheck-timestamp'
const SIGNATURE_HEADER = 'x-cryptocheck-signature'
const MAX_SKEW_SEC = 300

/**
 * Lightweight API protection helper — compose with existing HMAC/API-key auth.
 * Does not replace with-api-auth; adds bot score + replay/timestamp checks.
 */
export function evaluateApiBotGuard(req: NextRequest): {
  allow: boolean
  response?: NextResponse
  botScore: number
} {
  const cfg = resolveConfig()
  if (!cfg.enabled) return { allow: true, botScore: 0 }

  const ua = req.headers.get('user-agent')
  if (isSearchEngineCrawler(ua)) return { allow: true, botScore: 0 }

  const hasKey = Boolean(req.headers.get('authorization') || req.headers.get('x-api-key'))
  const hasSig = Boolean(req.headers.get(SIGNATURE_HEADER))
  const { missingBrowserHeaders, headerAnomalyScore } = headerAnomalyFromHeaders(req.headers, true)

  const result = computeBotScore(
    {
      userAgent: ua,
      missingBrowserHeaders,
      headerAnomalyScore,
      tier: hasKey || hasSig ? 'api_key' : 'anonymous',
      path: req.nextUrl.pathname,
      hasApiCredentials: hasKey || hasSig,
    },
    cfg,
  )

  // Anonymous API scrapers with high scores → block
  if (!hasKey && !hasSig && result.botScore >= cfg.stage4Min) {
    return {
      allow: false,
      botScore: result.botScore,
      response: NextResponse.json(
        { error: 'api_bot_blocked', botScore: result.botScore, reasons: result.reasons },
        { status: 429 },
      ),
    }
  }

  return { allow: true, botScore: result.botScore }
}

/**
 * Replay / timestamp / nonce validation for signed API calls.
 * Call after body is available when HMAC is required.
 */
export function assertApiReplayProtection(req: NextRequest, opts?: { requireNonce?: boolean }): void {
  const tsRaw = req.headers.get(TIMESTAMP_HEADER)?.trim()
  if (!tsRaw) {
    if (req.headers.get(SIGNATURE_HEADER)) {
      throw new Error('MISSING_TIMESTAMP')
    }
    return
  }
  const ts = Number(tsRaw)
  if (!Number.isFinite(ts)) throw new Error('INVALID_TIMESTAMP')
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > MAX_SKEW_SEC) throw new Error('REQUEST_EXPIRED')

  if (opts?.requireNonce) {
    const nonce = req.headers.get(NONCE_HEADER)?.trim()
    if (!nonce || nonce.length < 8) throw new Error('MISSING_NONCE')
  }
}

export function clientIpFromRequest(req: NextRequest): string | null {
  const maybeIp = (req as NextRequest & { ip?: string }).ip
  return pickClientIp(req.headers, maybeIp)
}
