import { DEFAULT_PLATFORM_FEE_BPS } from '@/lib/revenue-dashboard/constants'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

export { SOL_MINT, USDC_MINT }

export function getPlatformFeeBps(): number {
  const raw = process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS ?? process.env.PLATFORM_FEE_BPS
  const n = raw != null ? Number(raw) : DEFAULT_PLATFORM_FEE_BPS
  return Number.isFinite(n) && n >= 0 && n <= 500 ? Math.floor(n) : DEFAULT_PLATFORM_FEE_BPS
}

/** SPL token account (ATA) that receives Jupiter platform fees — safe to expose client-side. */
export function getPlatformFeeAccount(): string | null {
  const v =
    process.env.NEXT_PUBLIC_PLATFORM_FEE_ACCOUNT?.trim() ||
    process.env.PLATFORM_FEE_TOKEN_ACCOUNT?.trim()
  return v && v.length >= 32 ? v : null
}

export function isPlatformFeeConfigured(): boolean {
  return getPlatformFeeAccount() != null && getPlatformFeeBps() > 0
}
