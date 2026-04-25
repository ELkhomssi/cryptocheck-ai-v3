import type { ProductBand } from '@/lib/access-control/types'

function bandRank(b: ProductBand): number {
  if (b === 'enterprise') return 3
  if (b === 'elite') return 2
  if (b === 'deep') return 1
  return 0
}

function tierStringToBand(tier: string): ProductBand {
  const t = String(tier ?? '').trim().toUpperCase()
  /** Master key in DB — full stack (Deep + Elite + all Trading OS). */
  if (t === 'ENTERPRISE' || t === 'INSTITUTIONAL') return 'enterprise'
  if (t === 'PRO_MAX_ELITE') return 'elite'
  if (t === 'PRO_MAX_DEEP') return 'deep'
  return 'none'
}

function mergeBands(a: ProductBand, b: ProductBand): ProductBand {
  return bandRank(a) >= bandRank(b) ? a : b
}

/**
 * Infer product band from `profiles.tier` / SaaS tier strings.
 * When both sources exist, uses the higher band (e.g. SaaS ENTERPRISE + profile DEEP → enterprise).
 * Does not mutate billing — read-only mapping for UI + modules.
 */
export function inferProductBandFromTiers(input: {
  profileTier?: string | null
  saasTier?: string | null
}): ProductBand {
  const profileBand = tierStringToBand(String(input.profileTier ?? ''))
  const saasBand = tierStringToBand(String(input.saasTier ?? ''))
  return mergeBands(profileBand, saasBand)
}
