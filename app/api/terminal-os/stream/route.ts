import { resilientOverview, resilientTicker, resilientWhales, warmTerminalOsCache } from '@/lib/terminal-os/resilient-feed'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * SSE market stream — server polls providers on schedule, pushes to clients.
 * Browser never hits CoinGecko/DexScreener directly. Paint target <200ms on message.
 */
export async function GET() {
  const encoder = new TextEncoder()
  let closed = false
  let timer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      // Pre-warm on connect (demo first paint)
      void warmTerminalOsCache()
      send('ready', { ok: true, at: Date.now() })

      const tick = async () => {
        if (closed) return
        try {
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
        } catch (e) {
          send('error', { message: e instanceof Error ? e.message : 'stream tick failed' })
        }
      }

      await tick()
      // ~3s for prices / whales band — within §0 budget for poll sources
      timer = setInterval(() => void tick(), 3_000)
    },
    cancel() {
      closed = true
      if (timer) clearInterval(timer)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
