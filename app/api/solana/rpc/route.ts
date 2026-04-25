import { NextResponse } from 'next/server'
import { getRpcEndpoints } from '@/lib/helius-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Clean Solana JSON-RPC proxy.
 *
 * Why this exists:
 *   • Jupiter Terminal, the wallet-adapter ConnectionProvider, and the in-app
 *     Connection all need a reliable Solana RPC. Hitting
 *     `api.mainnet-beta.solana.com` directly from the browser was returning
 *     "RPC not responding" under load — that URL is heavily rate-limited.
 *   • We cannot ship the Helius API key to the browser. A server-side proxy
 *     uses the authenticated Helius endpoint server-side and keeps the key
 *     out of the client bundle.
 *   • We also want an absolute guarantee that the user's CryptoCheck API key
 *     (Authorization: Bearer cc_live_…) is never forwarded to external
 *     Solana RPCs or Jupiter's backend. This handler deliberately forwards
 *     only the JSON body and `Content-Type`, stripping every inbound header
 *     (Authorization, X-CryptoCheck-*, cookies, etc.).
 *
 * Behavior:
 *   • Accepts a standard Solana JSON-RPC payload (`{jsonrpc, id, method, params}`).
 *   • Tries Helius first, falls back to public mainnet-beta on 429/5xx/network error.
 *   • Returns the upstream JSON verbatim so web3.js / Jupiter see a normal response.
 */

type JsonRpcPayload = {
  jsonrpc?: unknown
  id?: unknown
  method?: unknown
  params?: unknown
}

function safeCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: safeCorsHeaders() })
}

export async function POST(req: Request) {
  let body: JsonRpcPayload | JsonRpcPayload[]
  try {
    body = (await req.json()) as JsonRpcPayload | JsonRpcPayload[]
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400, headers: safeCorsHeaders() }
    )
  }

  if (!body || (typeof body !== 'object' && !Array.isArray(body))) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } },
      { status: 400, headers: safeCorsHeaders() }
    )
  }

  let endpoints: string[]
  const userHeliusApiKey = req.headers.get('x-helius-api-key') ?? undefined
  try {
    endpoints = getRpcEndpoints(userHeliusApiKey)
  } catch {
    endpoints = ['https://api.mainnet-beta.solana.com']
  }

  const serialized = JSON.stringify(body)
  let lastStatus = 502
  let lastBody = '{"jsonrpc":"2.0","id":null,"error":{"code":-32603,"message":"All upstream RPCs failed"}}'

  for (const url of endpoints) {
    try {
      const upstream = await fetch(url, {
        method: 'POST',
        // NOTE: only Content-Type — no Authorization, no cookies, no custom
        // CryptoCheck headers. This is the whole point of the proxy.
        headers: { 'Content-Type': 'application/json' },
        body: serialized,
        cache: 'no-store',
      })

      const text = await upstream.text()
      if (upstream.status === 429 || upstream.status >= 500) {
        lastStatus = upstream.status
        lastBody = text
        continue
      }
      return new NextResponse(text, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          ...safeCorsHeaders(),
        },
      })
    } catch (err) {
      lastStatus = 502
      lastBody = JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : 'Upstream RPC failure',
        },
      })
    }
  }

  return new NextResponse(lastBody, {
    status: lastStatus,
    headers: { 'Content-Type': 'application/json', ...safeCorsHeaders() },
  })
}
