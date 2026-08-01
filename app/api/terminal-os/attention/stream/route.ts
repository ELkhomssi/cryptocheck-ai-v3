import { NextRequest } from 'next/server'
import { getAttentionSeq, getAttentionSnapshot } from '@/lib/terminal-os/attention-store'
import { runAttentionTick } from '@/lib/terminal-os/attention-engine'
import { warmTerminalOsCache } from '@/lib/terminal-os/resilient-feed'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * SSE Attention Feed — clients subscribe; never poll providers.
 * Server reads Redis snapshot written by cron/workers; light seq watch only.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() || null
  const encoder = new TextEncoder()
  let closed = false
  let timer: ReturnType<typeof setInterval> | null = null
  let lastSeq = -1
  let ticks = 0

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      void warmTerminalOsCache()
      send('ready', { ok: true, at: Date.now() })

      // Ensure first paint payload exists (cron may not have run yet in this env)
      let snap = await getAttentionSnapshot()
      if (!snap) {
        const tick = await runAttentionTick({ wallet })
        snap = tick.snapshot
      }
      lastSeq = snap.seq
      send('snapshot', {
        items: snap.items,
        seq: snap.seq,
        updatedAt: snap.updatedAt,
        events: snap.events,
      })

      timer = setInterval(() => {
        void (async () => {
          if (closed) return
          ticks += 1
          try {
            // Every ~60s allow a real engine tick (server-side); otherwise Redis-only
            if (ticks % 20 === 0) {
              const result = await runAttentionTick({ wallet })
              if (result.changed || result.snapshot.seq !== lastSeq) {
                lastSeq = result.snapshot.seq
                send('delta', {
                  items: result.snapshot.items,
                  seq: result.snapshot.seq,
                  updatedAt: result.snapshot.updatedAt,
                  events: result.snapshot.events,
                  newCount: result.newCount,
                  updatedCount: result.updatedCount,
                })
              }
              return
            }

            const seq = await getAttentionSeq()
            if (seq === lastSeq) return
            const next = await getAttentionSnapshot()
            if (!next) return
            lastSeq = next.seq
            send('delta', {
              items: next.items,
              seq: next.seq,
              updatedAt: next.updatedAt,
              events: next.events,
            })
          } catch (e) {
            send('error', { message: e instanceof Error ? e.message : 'attention stream tick failed' })
          }
        })()
      }, 3_000)
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
