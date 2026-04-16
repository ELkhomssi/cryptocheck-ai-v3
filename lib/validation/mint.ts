import { PublicKey } from '@solana/web3.js'

/**
 * Returns true if `s` is a valid Solana public key string (base58, on-curve).
 */
export function isValidSolanaMint(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  try {
    const pk = new PublicKey(t)
    return PublicKey.isOnCurve(pk.toBytes())
  } catch {
    return false
  }
}
