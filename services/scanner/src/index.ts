import 'dotenv/config'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { isValidSolanaMint, loadConfig } from './config.js'
import { deepAudit } from './scanner.js'
import { createServiceHeartbeat } from './service-heartbeat.js'

const cfg = loadConfig()

const stats = {
  startedAt: new Date().toISOString(),
  scans: 0,
  blocked: 0,
  safe: 0,
  errors: 0,
  lastScanMs: 0,
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage, limitBytes = 16_384): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limitBytes) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      data += chunk.toString('utf8')
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

async function handleScan(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let mint = ''
  try {
    const raw = await readBody(req)
    const parsed = raw ? (JSON.parse(raw) as { mint?: unknown; contractAddress?: unknown }) : {}
    mint = String(parsed.mint ?? parsed.contractAddress ?? '').trim()
  } catch {
    json(res, 400, { error: 'invalid JSON body' })
    return
  }

  if (!isValidSolanaMint(mint)) {
    json(res, 400, { error: 'mint is required (valid Solana base58 mint address)' })
    return
  }

  try {
    const report = await deepAudit(mint, cfg)
    stats.scans += 1
    stats.lastScanMs = report.latencyMs
    if (report.safeToSnipe) stats.safe += 1
    else stats.blocked += 1
    json(res, 200, report)
  } catch (e) {
    stats.errors += 1
    console.error('[scanner] scan failed', { mint, error: e instanceof Error ? e.message : e })
    json(res, 500, { error: 'scan failed', mint })
  }
}

function healthBody() {
  return {
    status: cfg.heliusRpcUrl && cfg.workerSecret ? 'ok' : 'degraded',
    service: 'scanner',
    heliusConfigured: Boolean(cfg.heliusRpcUrl),
    gatewayConfigured: Boolean(cfg.workerSecret),
    assessUrl: cfg.assessUrl,
    stats,
  }
}

async function main(): Promise<void> {
  const heartbeat = createServiceHeartbeat('scanner')
  heartbeat.start(() => ({
    status: cfg.heliusRpcUrl && cfg.workerSecret ? 'ok' : 'degraded',
    lagMs: stats.lastScanMs,
  }))

  const server = createServer((req, res) => {
    const url = req.url ?? '/'
    if ((req.method === 'GET' || req.method === 'HEAD') && (url === '/healthz' || url === '/health' || url === '/')) {
      json(res, 200, healthBody())
      return
    }
    if (req.method === 'POST' && (url === '/scan' || url === '/v1/scan')) {
      void handleScan(req, res)
      return
    }
    json(res, 404, { error: 'not found' })
  })

  server.listen(cfg.port, () => {
    console.info('[scanner] listening', {
      port: cfg.port,
      helius: Boolean(cfg.heliusRpcUrl),
      gateway: Boolean(cfg.workerSecret),
      timeoutMs: cfg.scanTimeoutMs,
    })
  })

  const shutdown = (signal: string) => {
    console.info('[scanner] shutting down', { signal })
    void heartbeat.beat({ status: 'down' }).finally(() => {
      server.close(() => process.exit(0))
    })
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((e) => {
  console.error('[scanner] fatal', e instanceof Error ? e.message : e)
  process.exit(1)
})
