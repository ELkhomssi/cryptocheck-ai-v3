import { NextRequest } from 'next/server'
import { withScanAccess, type ScanAccessContext } from '@/lib/auth/scan-access'
import { gatewayEventBus } from '@/lib/connect/scan-gateway'
import { getPulseFeed, type PulseEntry } from '@/lib/services/pulse-feed.service'
import { enrichSignalWithTradeContext } from '@/lib/trading/signal-trade-bridge'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const POLL_MS = 5000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * GET /api/trading/signals — Server-Sent Events stream of TradeSignal objects.
 * Sources: in-process gatewayEventBus (fast path) + durable Redis pulse feed (poll).
 * Filters: ?chain=solana&type=BUY&minConfidence=70
 * Auth: session or API key (withScanAccess). EventSource uses the session cookie.
 */
export const GET = withScanAccess(async (req: NextRequest, _ctx: ScanAccessContext) => {
  const params = req.nextUrl.searchParams
  const chainFilter = params.get('chain')?.trim().toLowerCase() || null
  const typeFilter = params.get('type')?.trim().toUpperCase() || null
  const minConfidence = Number(params.get('minConfidence') ?? '0') || 0

  const encoder = new TextEncoder()
  const seenRaw = new Set<string>()
  const pending: PulseEntry[] = []
  let closed = false

  // Fast path: immediate emit when a scan completes on this instance.
  const unsubscribe = gatewayEventBus.on((ev) => {
    if (ev.type === 'scan.completed' && ev.mint) {
      pending.push({
        mint: ev.mint,
        aggregateScore: ev.score,
        verdict: ev.verdict,
        institutionalGrade: '',
        ts: new Date().toISOString(),
      })
    }
  })

  const cleanup = () => {
    closed = true
    unsubscribe()
  }
  req.signal.addEventListener('abort', cleanup)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      send({ type: 'connected', ts: new Date().toISOString() })

      while (!closed) {
        const batch: PulseEntry[] = pending.splice(0, pending.length)
        try {
          batch.push(...(await getPulseFeed()))
        } catch {
          /* pulse optional */
        }

        for (const entry of batch) {
          if (closed) break
          const rawKey = `${entry.mint}:${entry.verdict}`
          if (seenRaw.has(rawKey)) continue
          seenRaw.add(rawKey)

          let signal
          try {
            signal = await enrichSignalWithTradeContext(entry)
          } catch {
            continue
          }

          if (signal.signalType !== 'BUY' && signal.signalType !== 'WATCH') continue
          if (chainFilter && signal.chain !== chainFilter) continue
          if (typeFilter && signal.signalType !== typeFilter) continue
          if (signal.confidence < minConfidence) continue

          send(signal)
        }

        send({ type: 'ping', ts: Date.now() })
        await sleep(POLL_MS)
      }

      try {
        controller.close()
      } catch {
        /* already closed */
      }
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'x-routed-via': 'gateway',
      'x-accel-buffering': 'no',
    },
  })
})
