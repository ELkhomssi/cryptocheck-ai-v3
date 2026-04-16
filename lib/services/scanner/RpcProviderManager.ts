import { Connection } from '@solana/web3.js'
import { getHeliusPrimaryRpcUrl } from '@/lib/helius-server'

export type RpcEndpoint = { label: string; url: string }

const connectionPool = new Map<string, Connection>()

function pooledConnection(url: string): Connection {
  let c = connectionPool.get(url)
  if (!c) {
    c = new Connection(url, {
      commitment: 'processed',
      confirmTransactionInitialTimeout: 60_000,
    })
    connectionPool.set(url, c)
  }
  return c
}

let cachedPrimary: Connection | null = null
let cachedPrimaryLabel: string | null = null

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
  push('Helius (primary)', getHeliusPrimaryRpcUrl())
  push('Solana mainnet (public fallback)', 'https://api.mainnet-beta.solana.com')
  return endpoints
}

/** Stable primary connection (singleton per RPC URL — reuses pooled sockets). */
export function getPrimaryConnection(): { connection: Connection; label: string } {
  const primary = listRpcEndpoints()[0]
  const conn = pooledConnection(primary.url)
  cachedPrimary = conn
  cachedPrimaryLabel = primary.label
  return { connection: cachedPrimary, label: cachedPrimaryLabel! }
}

/**
 * Attempts an async operation with the primary RPC; on failure tries fallbacks (pooled connections).
 */
export async function withRpcFailover<T>(
  runner: (connection: Connection, label: string) => Promise<T>
): Promise<{ result: T; label: string }> {
  const endpoints = listRpcEndpoints()
  let lastErr: unknown
  for (const ep of endpoints) {
    try {
      const connection = pooledConnection(ep.url)
      const result = await runner(connection, ep.label)
      return { result, label: ep.label }
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All RPC endpoints failed')
}
