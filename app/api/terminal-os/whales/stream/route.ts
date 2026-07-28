import { fetchLiveWhaleMovements } from '@/lib/terminal-os/live-market'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * SSE whale stream for Terminal OS marquee.
 * Serverless-friendly: push a snapshot every ~8s (clients merge into ring buffer).
 * Prefer WS when TERMINAL_OS_WHALE_WS_URL is set on the client; this is the default path.
 */
export async function GET() {
  const encoder = new TextEncoder()
  let closed = false
  let timer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        if (closed) return
        try {
          const items = await fetchLiveWhaleMovements(32)
          const payload = `event: whales\ndata: ${JSON.stringify({ items, ts: Date.now() })}\n\n`
          controller.enqueue(encoder.encode(payload))
        } catch (e) {
          const message = e instanceof Error ? e.message : 'whale stream error'
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`),
          )
        }
      }

      controller.enqueue(encoder.encode(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`))
      await send()
      timer = setInterval(() => {
        void send()
      }, 8_000)
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
