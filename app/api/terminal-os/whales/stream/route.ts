import { fetchLiveWhaleMovements } from '@/lib/terminal-os/live-market'
import {
  createSseStream,
  SSE_MAX_DURATION_SEC,
  SSE_RESPONSE_HEADERS,
} from '@/lib/terminal-os/sse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = SSE_MAX_DURATION_SEC

/**
 * SSE whale stream for Terminal OS marquee.
 * Soft-closes before Vercel’s hard 300s kill; clients reconnect on `reconnect`.
 */
export async function GET() {
  const stream = createSseStream({
    intervalMs: 8_000,
    onTick: async (send) => {
      const items = await fetchLiveWhaleMovements(32)
      send('whales', { items, ts: Date.now() })
    },
  })

  return new Response(stream, { headers: SSE_RESPONSE_HEADERS })
}
