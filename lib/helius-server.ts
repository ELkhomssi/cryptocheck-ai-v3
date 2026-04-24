import 'server-only'

import type {
  HeliusTx,
  HoldersResult,
  PortfolioHolding,
  ScanData,
  TokenMeta,
  TokenSupplyResult,
} from '@/lib/helius'

/** Helius REST v0 base URL (no key — append `?api-key=` server-side only). */
export const HELIUS_API = 'https://api.helius.xyz/v0'

/**
 * Canonical: `HELIUS_API_KEY`. Also accepts legacy `HELIUS_KEY` so renamed Vercel envs still work.
 */
export function getHeliusApiKeyFromEnv(): string | undefined {
  return process.env.HELIUS_API_KEY?.trim() || process.env.HELIUS_KEY?.trim() || undefined
}

function requireHeliusKey(): string {
  const k = getHeliusApiKeyFromEnv()
  if (!k) {
    throw new Error('HELIUS_API_KEY is not configured (set HELIUS_API_KEY or legacy HELIUS_KEY)')
  }
  return k
}

/** Primary authenticated Helius JSON-RPC URL — server-only; never expose to the client. */
export function getHeliusPrimaryRpcUrl(): string {
  return `https://mainnet.helius-rpc.com/?api-key=${requireHeliusKey()}`
}

/** Build a Helius REST URL with the API key — server-only. */
export function buildHeliusRestUrl(path: string): string {
  const key = requireHeliusKey()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${HELIUS_API}${p}?api-key=${key}`
}

/**
 * Helius REST URL with `api-key` plus optional query params (e.g. `limit`, `type`).
 * Use for GET endpoints like `/addresses/{mint}/transactions`.
 */
export function buildHeliusApiUrl(
  path: string,
  extraQuery?: Record<string, string | number | undefined>
): string {
  const key = requireHeliusKey()
  const p = path.startsWith('/') ? path : `/${path}`
  const u = new URL(`${HELIUS_API}${p}`)
  u.searchParams.set('api-key', key)
  if (extraQuery) {
    for (const [k, v] of Object.entries(extraQuery)) {
      if (v !== undefined && v !== '') u.searchParams.set(k, String(v))
    }
  }
  return u.toString()
}

function rpcErrorIsFailoverWorthy(err: { code?: number; message?: string } | undefined): boolean {
  if (!err) return false
  const c = err.code
  const m = String(err.message ?? '').toLowerCase()
  return (
    c === -32005 ||
    c === -32603 ||
    c === 429 ||
    m.includes('429') ||
    m.includes('503') ||
    m.includes('timed out') ||
    m.includes('timeout') ||
    m.includes('rate limit') ||
    m.includes('too many requests') ||
    m.includes('overloaded') ||
    m.includes('load') ||
    m.includes('try again')
  )
}

export function getRpcEndpoints(): string[] {
  const primary = getHeliusPrimaryRpcUrl()
  const extra = [process.env.SOLANA_RPC_FALLBACK_URL].filter(Boolean) as string[]
  const publicFallback = 'https://api.mainnet-beta.solana.com'
  return Array.from(new Set([primary, ...extra, publicFallback]))
}

export async function rpcCall<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const payload = { jsonrpc: '2.0', id: 1, method, params }
  const endpoints = getRpcEndpoints()
  let lastMessage = 'RPC error'
  for (let i = 0; i < endpoints.length; i++) {
    const url = endpoints[i]
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) {
        lastMessage = data.error.message ?? 'RPC error'
        if (rpcErrorIsFailoverWorthy(data.error) && i < endpoints.length - 1) continue
        throw new Error(lastMessage)
      }
      if (!res.ok && i < endpoints.length - 1) continue
      return data.result as T
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : String(e)
      if (i < endpoints.length - 1) continue
      throw e instanceof Error ? e : new Error(lastMessage)
    }
  }
  throw new Error(lastMessage)
}

export async function heliusRest<T = unknown>(path: string, body?: unknown): Promise<T> {
  const url = buildHeliusRestUrl(path)
  let lastErr: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (res.status === 429 || res.status === 503) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)))
        continue
      }
      if (!res.ok) throw new Error(`Helius API ${res.status}: ${await res.text()}`)
      return res.json() as Promise<T>
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
    }
  }
  throw lastErr ?? new Error('Helius API failed')
}

export async function dasCall<T = unknown>(method: string, params: unknown): Promise<T> {
  const res = await fetch(getHeliusPrimaryRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message ?? 'DAS error')
  return data.result as T
}

export async function scanToken(mint: string): Promise<ScanData> {
  const [meta, supply, holders, txs] = await Promise.allSettled([
    heliusRest<TokenMeta[]>('/token-metadata', { mintAccounts: [mint] }),
    rpcCall<TokenSupplyResult>('getTokenSupply', [mint]),
    rpcCall<HoldersResult>('getTokenLargestAccounts', [mint]),
    heliusRest<HeliusTx[]>(`/addresses/${mint}/transactions`),
  ])

  return {
    mint,
    meta: meta.status === 'fulfilled' ? (meta.value[0] ?? null) : null,
    supply: supply.status === 'fulfilled' ? supply.value : null,
    holders: holders.status === 'fulfilled' ? holders.value : null,
    txs:
      txs.status === 'fulfilled' && Array.isArray(txs.value) ? txs.value.slice(0, 20) : [],
    scannedAt: Date.now(),
  }
}

export async function fetchPortfolio(walletAddress: string): Promise<PortfolioHolding[]> {
  const tokenAccounts = await rpcCall<{
    value: Array<{
      account: {
        data: {
          parsed: {
            info: {
              mint: string
              tokenAmount: { uiAmount: number; decimals: number }
            }
          }
        }
      }
    }>
  }>('getTokenAccountsByOwner', [
    walletAddress,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' },
  ])

  const holdings = (tokenAccounts?.value ?? [])
    .filter((a) => {
      const ui = a.account?.data?.parsed?.info
      return ui && (ui.tokenAmount?.uiAmount ?? 0) > 0
    })
    .slice(0, 25)
    .map((a) => {
      const info = a.account.data.parsed.info
      return {
        mint: info.mint,
        amount: info.tokenAmount?.uiAmount ?? 0,
        decimals: info.tokenAmount?.decimals ?? 0,
      }
    })

  if (!holdings.length) return []

  const mints = holdings.map((h) => h.mint)
  let metaMap: Record<string, TokenMeta> = {}
  try {
    const metaArr = await heliusRest<TokenMeta[]>('/token-metadata', { mintAccounts: mints })
    metaArr.forEach((m) => {
      const key = m.account ?? ''
      if (key) metaMap[key] = m
    })
  } catch {
    // metadata is best-effort
  }

  return holdings.map((h) => {
    const meta = metaMap[h.mint] ?? null
    const name = meta?.onChainMetadata?.metadata?.data?.name ?? meta?.legacyMetadata?.name ?? 'Unknown'
    const symbol = meta?.onChainMetadata?.metadata?.data?.symbol ?? meta?.legacyMetadata?.symbol ?? '???'
    const mintAuth = meta?.onChainMetadata?.metadata?.updateAuthority ?? null

    let score = 60
    if (!meta) score -= 15
    if (name === 'Unknown') score -= 8
    if (mintAuth) score -= 12
    score = Math.max(5, Math.min(100, score))

    return { ...h, name, symbol, mintAuth, score }
  })
}

export async function getSlot(): Promise<number> {
  return rpcCall<number>('getSlot')
}
