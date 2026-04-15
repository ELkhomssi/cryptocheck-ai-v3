import { Connection } from '@solana/web3.js'
import { HELIUS_KEY, HELIUS_RPC } from '@/lib/helius'

export type RpcEndpoint = { label: string; url: string }

let cachedPrimary: Connection | null = null
let cachedPrimaryLabel: string | null = null

function heliusUrl(): string {
  const key = process.env.HELIUS_KEY || HELIUS_KEY
  return `https://mainnet.helius-rpc.com/?api-key=${key}`
}

/**
 * Ordered RPC endpoints — primary Helius, then public fallbacks for read/simulate failover.
 */
export function listRpcEndpoints(): RpcEndpoint[] {
  const seen = new Set<string>()
  const endpoints: RpcEndpoint[] = []
  const push = (label: string, url: string) => {
    if (seen.has(url)) return
    seen.add(url)
    endpoints.push({ label, url })
  }
  push('Helius (primary)', heliusUrl())
  push('Solana mainnet (public fallback)', 'https://api.mainnet-beta.solana.com')
  if (HELIUS_RPC && !seen.has(HELIUS_RPC)) push('Helius (HELIUS_RPC)', HELIUS_RPC)
  return endpoints
}

/** Stable primary connection (singleton) for hot path — matches legacy `getSolanaConnection`. */
export function getPrimaryConnection(): { connection: Connection; label: string } {
  if (cachedPrimary && cachedPrimaryLabel) {
    return { connection: cachedPrimary, label: cachedPrimaryLabel }
  }
  const primary = listRpcEndpoints()[0]
  cachedPrimary = new Connection(primary.url, { commitment: 'processed' })
  cachedPrimaryLabel = primary.label
  return { connection: cachedPrimary, label: cachedPrimaryLabel }
}

/**
 * Attempts an async operation with the primary RPC; on failure tries fallbacks (stateless).
 * Suitable for one-off simulate calls when the primary times out.
 */
export async function withRpcFailover<T>(
  runner: (connection: Connection, label: string) => Promise<T>
): Promise<{ result: T; label: string }> {
  const endpoints = listRpcEndpoints()
  let lastErr: unknown
  for (const ep of endpoints) {
    try {
      const connection = new Connection(ep.url, { commitment: 'processed' })
      const result = await runner(connection, ep.label)
      return { result, label: ep.label }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All RPC endpoints failed')
}
