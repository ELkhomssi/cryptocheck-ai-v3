import { UnsupportedLiquidityProvider, type LiquidityProvider, type LiquidityProviderId } from './provider'
import { RaydiumCpmmLiquidityProvider } from './raydium-cpmm'

const providers: Record<LiquidityProviderId, LiquidityProvider> = {
  'raydium-cpmm': new RaydiumCpmmLiquidityProvider(),
  meteora: new UnsupportedLiquidityProvider('meteora', 'Meteora'),
  orca: new UnsupportedLiquidityProvider('orca', 'Orca'),
  pumpswap: new UnsupportedLiquidityProvider('pumpswap', 'PumpSwap'),
}

export function getLiquidityProvider(id: LiquidityProviderId = 'raydium-cpmm'): LiquidityProvider {
  return providers[id]
}

export function listLiquidityProviders(): LiquidityProvider[] {
  return Object.values(providers)
}

export type { LiquidityProvider, LiquidityProviderId, LiquidityMigratePlan } from './provider'
