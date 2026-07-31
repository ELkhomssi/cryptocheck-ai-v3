import { NextRequest } from 'next/server'
import { evaluateAlertsForWallet } from '@/lib/terminal-os/alert-engine'
import { resilientTicker } from '@/lib/terminal-os/resilient-feed'
import { isValidSolanaMint } from '@/lib/validation/mint'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * SSE alert stream — continuously evaluates active rules against live ticker
 * and pushes newly fired alerts in real time (same channel family as market SSE).
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

  const encoder = new TextEncoder()
  let closed = false
  let timer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      send('ready', { ok: true, wallet, at: Date.now() })

      const tick = async () => {
        if (closed) return
        try {
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
        } catch (e) {
          send('error', { message: e instanceof Error ? e.message : 'alert stream tick failed' })
        }
      }

      await tick()
      timer = setInterval(() => void tick(), 8_000)
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
