import { DEFAULT_PLATFORM_FEE_BPS } from '@/lib/revenue-dashboard/constants'
import { PublicKey } from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

export { SOL_MINT, USDC_MINT }

export function getPlatformFeeBps(): number {
  const raw = process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? process.env.PLATFORM_FEE_BPS
  const n = raw != null ? Number(raw) : DEFAULT_PLATFORM_FEE_BPS
  return Number.isFinite(n) && n >= 0 && n <= 500 ? Math.floor(n) : DEFAULT_PLATFORM_FEE_BPS
}

/**
 * Explicit fee ATA (legacy). Prefer PLATFORM_FEE_AUTHORITY so we can derive
 * the correct output-mint ATA per swap.
 */
export function getPlatformFeeAccount(): string | null {
  const v =
    process.env.NEXT_PUBLIC_PLATFORM_FEE_ACCOUNT?.trim() ||
    process.env.PLATFORM_FEE_TOKEN_ACCOUNT?.trim()
  return v && v.length >= 32 ? v : null
}

/** Fee-receiving wallet — ATAs for each output mint are derived from this. */
export function getPlatformFeeAuthority(): string | null {
  const v =
    process.env.NEXT_PUBLIC_PLATFORM_FEE_AUTHORITY?.trim() ||
    process.env.PLATFORM_FEE_AUTHORITY?.trim()
  return v && v.length >= 32 ? v : null
}

export function isPlatformFeeConfigured(): boolean {
  return (
    getPlatformFeeBps() > 0 &&
    (getPlatformFeeAccount() != null || getPlatformFeeAuthority() != null)
  )
}

/** Derive (or return fixed) fee token account for a given swap output mint. */
export function resolvePlatformFeeAccountForMint(outputMint: string): string | null {
  const fixed = getPlatformFeeAccount()
  if (fixed) return fixed

  const authority = getPlatformFeeAuthority()
  if (!authority) return null
  try {
    const mint = new PublicKey(outputMint.trim())
    const owner = new PublicKey(authority)
    return getAssociatedTokenAddressSync(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ).toBase58()
  } catch {
    return null
  }
}
