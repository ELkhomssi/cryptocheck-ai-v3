#!/usr/bin/env node
/**
 * Minimal Upstash Redis REST-compatible shim against local redis-cli.
 * Supports:
 *   POST /           JSON command array → { result } | { error }
 *   POST /pipeline   JSON array of command arrays → [{ result } | { error }, ...]
 * Auth: Authorization: Bearer <token> must match SHIM_TOKEN.
 */
import http from 'node:http'
import { spawnSync } from 'node:child_process'
import { URL } from 'node:url'

const PORT = Number(process.env.UPSTASH_SHIM_PORT ?? 8079)
const TOKEN = process.env.UPSTASH_SHIM_TOKEN ?? 'local-dev-upstash-token'
const REDIS_CLI = process.env.REDIS_CLI ?? 'redis-cli'

function runRedis(args) {
  const r = spawnSync(REDIS_CLI, ['--raw', ...args.map(String)], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
  if (r.error) throw r.error
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || `redis-cli exit ${r.status}`).trim()
    throw new Error(err || `redis-cli exit ${r.status}`)
  }
  return r.stdout
}

function coerceResult(cmd, raw) {
  const out = raw.replace(/\n$/, '')
  const c = String(cmd).toUpperCase()
  if (out === '') {
    if (c === 'SET') return 'OK'
    if (c === 'GET') return null
    return null
  }
  if (c === 'SET') return 'OK'
  if (c === 'XLEN' || c === 'EXISTS' || c === 'TTL' || c === 'DEL') {
    const n = Number(out)
    return Number.isFinite(n) ? n : out
  }
  if (c === 'XRANGE' || c === 'XREVRANGE') {
    const lines = out.split('\n').filter((l) => l.length > 0)
    const entries = []
    let i = 0
    while (i < lines.length) {
      const id = lines[i++]
      const fields = []
      while (i < lines.length && (fields.length === 0 || !/^\d+-\d+$/.test(lines[i]))) {
        fields.push(lines[i++])
        if (i >= lines.length) break
        if (fields.length % 2 === 0 && i < lines.length && /^\d+-\d+$/.test(lines[i])) break
      }
      entries.push([id, fields])
    }
    return entries
  }
  return out
}

function execOne(args) {
  const raw = runRedis(args)
  return coerceResult(args[0], raw)
}

const server = http.createServer(async (req, res) => {
  const auth = req.headers.authorization ?? ''
  if (auth !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  if (req.method !== 'POST') {
    res.writeHead(405)
    res.end()
    return
  }
  const chunks = []
  for await (const c of req) chunks.push(c)
  let body
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'invalid json' }))
    return
  }

  const isPipeline =
    url.pathname === '/pipeline' ||
    url.pathname === '/multi-exec' ||
    (Array.isArray(body) && body.length > 0 && Array.isArray(body[0]))

  try {
    if (isPipeline) {
      if (!Array.isArray(body) || body.length === 0) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'expected pipeline command arrays' }))
        return
      }
      const results = body.map((args) => {
        try {
          if (!Array.isArray(args) || args.length === 0) {
            return { error: 'invalid command' }
          }
          return { result: execOne(args) }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(results))
      return
    }

    if (!Array.isArray(body) || body.length === 0) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'expected command array' }))
      return
    }
    const result = execOne(body)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ result }))
  } catch (e) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[upstash-rest-shim] http://127.0.0.1:${PORT} token_len=${TOKEN.length} (pipeline OK)`)
})
