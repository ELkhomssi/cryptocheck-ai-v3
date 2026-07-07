import { createServer, type IncomingMessage } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocketServer, type WebSocket } from 'ws'
import type { SignalFeedEvent } from '@cryptocheck/signal-contracts'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { FeedStreamReader } from './lib/feed-stream.js'
import { fetchHistory, resolveTier } from './lib/history.js'
import { parseFilter } from './lib/filters.js'
import { createServiceHeartbeat, readServiceHeartbeat } from './lib/service-heartbeat.js'
import { WsClientSession } from './ws/session.js'

const PORT = Number(process.env.PORT ?? process.env.SIGNAL_REALTIME_PORT ?? 4102)

function parseBearer(req: IncomingMessage): string | undefined {
  const h = req.headers.authorization
  if (!h) return undefined
  return h.replace(/^Bearer\s+/i, '').trim()
}

export function startRealtimeGateway(): void {
  const feed = new FeedStreamReader()
  const sessions = new Map<WebSocket, WsClientSession>()

  feed.subscribe((event: SignalFeedEvent) => {
    for (const session of sessions.values()) {
      session.enqueue(event)
    }
  })

  void feed.start()

  const heartbeat = createServiceHeartbeat('realtime-gateway')
  heartbeat.start(() => ({
    status: 'ok',
    channels: sessions.size,
  }))

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

    if (url.pathname === '/health' || url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', service: 'signal-realtime', clients: sessions.size }))
      return
    }

    if (url.pathname === '/v1/history' && req.method === 'GET') {
      try {
        const bearer = parseBearer(req)
        const queryToken = url.searchParams.get('token')?.trim()
        const authToken = bearer || queryToken
        const userId = url.searchParams.get('userId') ?? undefined
        const tier = await resolveTier({ bearer: authToken, userId })
        const filter = parseFilter({
          chain: url.searchParams.get('chain') ?? undefined,
          minVerdict: url.searchParams.get('minVerdict') ?? undefined,
          minSourceCount: url.searchParams.get('minSourceCount')
            ? Number(url.searchParams.get('minSourceCount'))
            : undefined,
          search: url.searchParams.get('search') ?? undefined,
          sourceTag: url.searchParams.get('sourceTag') ?? undefined,
          subjectType: url.searchParams.get('subjectType') ?? undefined,
        })
        const limit = Number(url.searchParams.get('limit') ?? 50)
        const signals = await fetchHistory(tier, filter, limit)
        res.writeHead(200, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        })
        res.end(JSON.stringify({ tier, signals, compliance: SIGNAL_COMPLIANCE }))
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'History failed' }))
      }
      return
    }

    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })

  const wss = new WebSocketServer({ server })

  wss.on('connection', async (ws, req) => {
    const session = new WsClientSession(ws, randomUUID())
    sessions.set(ws, session)

    const bearer = parseBearer(req)
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const queryToken = url.searchParams.get('token')?.trim()
    const authToken = bearer || queryToken
    const userId = url.searchParams.get('userId') ?? undefined
    const tier = await resolveTier({ bearer: authToken, userId })
    session.setSubscription(tier, {})

    const telegramHb = await readServiceHeartbeat('telegram-monitor')
    const monitoredChannels = telegramHb?.channels ?? 0

    ws.send(
      JSON.stringify({
        type: 'hello',
        tier,
        serverTime: new Date().toISOString(),
        monitoredChannels,
        compliance: SIGNAL_COMPLIANCE,
        delayMs: tier === 'free' ? Number(process.env.SIGNAL_FREE_DELAY_MS ?? 90_000) : 0,
      }),
    )

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(String(data)) as {
          type?: string
          filter?: unknown
          userId?: string
        }
        if (msg.type !== 'subscribe') return

        const nextTier = await resolveTier({
          bearer: authToken,
          userId: msg.userId ?? userId,
        })
        session.setSubscription(nextTier, parseFilter(msg.filter))
        ws.send(JSON.stringify({ type: 'subscribed', tier: nextTier, filter: session.activeFilter }))
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid subscribe payload' }))
      }
    })

    ws.on('close', () => {
      session.close()
      sessions.delete(ws)
    })
  })

  server.listen(PORT, () => {
    console.info('[signal-realtime] listening', { port: PORT, ws: true, history: '/v1/history' })
  })
}
