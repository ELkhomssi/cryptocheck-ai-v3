import { NextRequest } from 'next/server'
import { getAttentionSeq, getAttentionSnapshot } from '@/lib/terminal-os/attention-store'
import { runAttentionTick } from '@/lib/terminal-os/attention-engine'
import { warmTerminalOsCache } from '@/lib/terminal-os/resilient-feed'
import {
  attachSseLifecycle,
  SSE_MAX_DURATION_SEC,
  SSE_RESPONSE_HEADERS,
} from '@/lib/terminal-os/sse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = SSE_MAX_DURATION_SEC

/**
 * SSE Attention Feed — clients subscribe; never poll providers.
 * Soft-closes before Vercel’s hard 300s kill; clients reconnect on `reconnect`.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() || null
  let lifeCancel: (() => void) | null = null
  let ticks = 0
  let lastSeq = -1

  const stream = new ReadableStream({
    async start(controller) {
      const life = attachSseLifecycle(controller)
      lifeCancel = life.cancel
      void warmTerminalOsCache()

      try {
        let snap = await getAttentionSnapshot()
        if (!snap) {
          const tick = await runAttentionTick({ wallet })
          snap = tick.snapshot
        }
        lastSeq = snap.seq
        life.send('snapshot', {
          items: snap.items,
          seq: snap.seq,
          updatedAt: snap.updatedAt,
          events: snap.events,
        })
      } catch (e) {
        life.send('error', {
          message: e instanceof Error ? e.message : 'attention stream failed to start',
        })
      }

      const timer = setInterval(() => {
        void (async () => {
          if (life.isClosed()) return
          ticks += 1
          try {
            if (ticks % 20 === 0) {
              const result = await runAttentionTick({ wallet })
              if (result.changed || result.snapshot.seq !== lastSeq) {
                lastSeq = result.snapshot.seq
                life.send('delta', {
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
            life.send('delta', {
              items: next.items,
              seq: next.seq,
              updatedAt: next.updatedAt,
              events: next.events,
            })
          } catch (e) {
            life.send('error', {
              message: e instanceof Error ? e.message : 'attention stream tick failed',
            })
          }
        })()
      }, 3_000)
      life.trackTimer(timer)
    },
    cancel() {
      lifeCancel?.()
    },
  })

  return new Response(stream, { headers: SSE_RESPONSE_HEADERS })
}
