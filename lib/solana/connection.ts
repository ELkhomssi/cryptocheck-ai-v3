import { Connection } from '@solana/web3.js'
import { HELIUS_KEY, HELIUS_RPC } from '@/lib/helius'

let _conn: Connection | null = null

/** Primary RPC for simulations (Helius env or bundled fallback). */
export function getSolanaConnection(): Connection {
  if (_conn) return _conn
  const key = process.env.HELIUS_KEY || HELIUS_KEY
  const url = `https://mainnet.helius-rpc.com/?api-key=${key}`
  _conn = new Connection(url || HELIUS_RPC, {
    commitment: 'processed',
  })
  return _conn
}
