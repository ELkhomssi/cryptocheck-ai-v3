import { NextRequest } from 'next/server'
import { evaluateAlertsForWallet } from '@/lib/terminal-os/alert-engine'
import { resilientTicker } from '@/lib/terminal-os/resilient-feed'
import {
  createSseStream,
  SSE_MAX_DURATION_SEC,
  SSE_RESPONSE_HEADERS,
} from '@/lib/terminal-os/sse'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = SSE_MAX_DURATION_SEC

/**
 * SSE alert stream — evaluates active rules against live ticker.
 * Soft-closes before Vercel’s hard 300s kill; clients reconnect on `reconnect`.
 * GET /api/terminal-os/alerts/stream?wallet=
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!wallet || (!isValidSolanaMint(wallet) && !/^0x[a-fA-F0-9]{40}$/.test(wallet))) {
    return new Response(JSON.stringify({ error: 'Valid wallet required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const stream = createSseStream({
    intervalMs: 8_000,
    readyPayload: { wallet },
    onTick: async (send) => {
      const ticker = await resilientTicker()
      const prices: Record<string, number> = {}
      for (const q of ticker.data ?? []) {
        prices[q.symbol] = q.priceUsd
      }
      const result = await evaluateAlertsForWallet(wallet, { prices })
      if (result.fired.length) {
        send('alert', { fired: result.fired, at: Date.now() })
      } else {
        send('heartbeat', { activeRules: result.activeRules, at: Date.now() })
      }
    },
  })

  return new Response(stream, { headers: SSE_RESPONSE_HEADERS })
}
