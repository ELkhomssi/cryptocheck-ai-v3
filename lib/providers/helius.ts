import 'server-only'

import { cachedJson } from '@/lib/cache/ttl'
import { getHeliusApiKeyFromEnv } from '@/lib/helius-server'

const TIMEOUT_MS = 8_000
const HOLDINGS_TTL_SEC = 20
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

export type HeliusDasAsset = {
  id?: string
  interface?: string
  content?: {
    metadata?: { name?: string; symbol?: string }
    links?: { image?: string }
    files?: Array<{ uri?: string; cdn_uri?: string }>
  }
  token_info?: {
    balance?: number
    decimals?: number
    symbol?: string
    price_info?: { price_per_token?: number }
  }
}

export type ParsedTokenAccount = {
  mint: string
  amount: number
  decimals: number
  uiAmount: number
}

function heliusRpcUrl(): string | null {
  const explicit = process.env.HELIUS_RPC_URL?.trim()
  if (explicit) return explicit
  const key = getHeliusApiKeyFromEnv()
  if (!key) return null
  return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`
}

async function postRpc(
  url: string,
  method: string,
  params: unknown,
): Promise<{ result?: unknown; error?: { message?: string; code?: number } } | null> {
  const { providerFetch } = await import('@/lib/providers/http')
  const result = await providerFetch('helius', url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params }),
    timeoutMs: TIMEOUT_MS,
  })
  if (!result.ok) return null
  try {
    return (await result.res.json()) as {
      result?: unknown
      error?: { message?: string; code?: number }
    }
  } catch {
    return null
  }
}

/**
 * JSON-RPC via Helius (or HELIUS_RPC_URL). Returns null when unconfigured / failed.
 * Never exposes the API key to the client.
 */
export async function rpc(method: string, params: unknown = []): Promise<unknown | null> {
  const url = heliusRpcUrl()
  if (!url) return null
  const body = await postRpc(url, method, params)
  if (!body || body.error) return null
  return body.result ?? null
}

/**
 * Helius DAS getAssetsByOwner — fungible tokens. Empty array when key missing / failure.
 */
export async function getAssetsByOwner(owner: string): Promise<HeliusDasAsset[]> {
  if (!owner || owner.length < 32) return []
  const url = heliusRpcUrl()
  if (!url) return []

  // ~20s holdings cache
  return cachedJson(`helius:das:${owner}`, HOLDINGS_TTL_SEC, async () => {
    const items: HeliusDasAsset[] = []
    let page = 1
    for (;;) {
      const body = await postRpc(url, 'getAssetsByOwner', {
        ownerAddress: owner,
        page,
        limit: 1000,
        displayOptions: {
          showFungible: true,
          showNativeBalance: false,
        },
      })
      if (!body || body.error) break
      const result = body.result as { items?: HeliusDasAsset[] } | undefined
      const batch = result?.items ?? []
      items.push(...batch)
      if (batch.length < 1000) break
      page += 1
      if (page > 5) break
    }
    return items
  })
}

/**
 * getParsedTokenAccountsByOwner — empty when unconfigured / failure.
 */
export async function getParsedTokenAccounts(owner: string): Promise<ParsedTokenAccount[]> {
  if (!owner || owner.length < 32) return []
  const url = heliusRpcUrl()
  if (!url) return []

  // ~20s holdings cache
  return cachedJson(`helius:parsed:${owner}`, HOLDINGS_TTL_SEC, async () => {
    const body = await postRpc(url, 'getParsedTokenAccountsByOwner', [
      owner,
      { programId: TOKEN_PROGRAM },
      { encoding: 'jsonParsed' },
    ])
    if (!body || body.error) return []
    const result = body.result as {
      value?: Array<{
        account: {
          data: {
            parsed?: {
              info?: {
                mint?: string
                tokenAmount?: { uiAmount?: number | null; amount?: string; decimals?: number }
              }
            }
          }
        }
      }>
    }
    const out: ParsedTokenAccount[] = []
    for (const row of result?.value ?? []) {
      const info = row.account.data.parsed?.info
      const mint = info?.mint
      if (!mint) continue
      const decimals = info?.tokenAmount?.decimals ?? 0
      const uiAmount =
        typeof info?.tokenAmount?.uiAmount === 'number' ? info.tokenAmount.uiAmount : 0
      const raw = Number(info?.tokenAmount?.amount ?? 0)
      out.push({
        mint,
        amount: Number.isFinite(raw) ? raw : 0,
        decimals,
        uiAmount: Number.isFinite(uiAmount) ? uiAmount : 0,
      })
    }
    return out
  })
}
