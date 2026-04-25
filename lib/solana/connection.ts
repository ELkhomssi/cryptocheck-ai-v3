import type { Connection } from '@solana/web3.js'
import { getPrimaryConnection } from '@/lib/services/scanner/RpcProviderManager'

/** Primary RPC for simulations — delegated to institutional RpcProviderManager (Helius-first). */
export function getSolanaConnection(): Connection {
  return getPrimaryConnection().connection
}
