import {
  createSseStream,
  SSE_MAX_DURATION_SEC,
  SSE_RESPONSE_HEADERS,
} from '@/lib/terminal-os/sse'
import { resilientOverview, resilientTicker, resilientWhales, warmTerminalOsCache } from '@/lib/terminal-os/resilient-feed'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = SSE_MAX_DURATION_SEC

/**
 * SSE market stream — server polls providers on schedule, pushes to clients.
 * Soft-closes before Vercel’s hard 300s kill; clients reconnect on `reconnect`.
 */
export async function GET() {
  const stream = createSseStream({
    intervalMs: 3_000,
    onStart: () => {
      void warmTerminalOsCache()
    },
    onTick: async (send) => {
      const [ticker, overview, whales] = await Promise.all([
        resilientTicker(),
        resilientOverview(),
        resilientWhales(16),
      ])
      send('market', {
        ticker: ticker.data,
        overview: overview.data,
        whales: whales.data,
        meta: {
          ticker: { stale: ticker.stale, demo: ticker.demo, ageSec: ticker.ageSec, source: ticker.source },
          overview: {
            stale: overview.stale,
            demo: overview.demo,
            ageSec: overview.ageSec,
            source: overview.source,
          },
          whales: { stale: whales.stale, demo: whales.demo, ageSec: whales.ageSec, source: whales.source },
        },
        ts: Date.now(),
      })
    },
  })

  return new Response(stream, { headers: SSE_RESPONSE_HEADERS })
}
