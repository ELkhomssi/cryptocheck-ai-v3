import { FEATURE_MATRIX, type ProductBand, type TradingOsFeature } from '@/lib/access-control/types'
import { inferProductBandFromTiers } from '@/lib/access-control/infer-band'

export type AccessContext = {
  profileTier?: string | null
  saasTier?: string | null
}

/**
 * Non-destructive capability check. Stripe unchanged — reads tier strings only.
 * DB `ENTERPRISE` resolves to `enterprise` and satisfies every Trading OS feature.
 */
export function hasAccess(ctx: AccessContext, feature: TradingOsFeature): boolean {
  const band = inferProductBandFromTiers(ctx)
  if (band === 'none') return false
  if (band === 'enterprise') return true
  const allowed = FEATURE_MATRIX[feature]
  return allowed.includes(band)
}

export function getProductBand(ctx: AccessContext): ProductBand {
  return inferProductBandFromTiers(ctx)
}
