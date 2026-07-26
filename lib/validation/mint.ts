import { PublicKey } from '@solana/web3.js'

/**
 * True if `s` is a valid Solana public-key encoding (base58, 32 bytes).
 * Use for **token mints** (may be off-curve PDAs). Do not require on-curve.
 */
export function isValidSolanaAddress(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  try {
    // Constructor throws on invalid base58 / wrong length
    void new PublicKey(t)
    return true
  } catch {
    return false
  }
}

/**
 * Returns true if `s` is a valid Solana public key string (base58, on-curve).
 * Prefer for **wallet** addresses. For token mints use `isValidSolanaAddress`.
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
