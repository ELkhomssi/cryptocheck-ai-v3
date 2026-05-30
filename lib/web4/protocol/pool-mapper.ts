import { lamportsToSol, baseToTokens } from '@/lib/web4/bonding-curve/math'
import type { BondingToken } from '@/app/dashboard/web4-terminal/pump-curve'
import { GRADIENTS, EMOJIS } from '@/app/dashboard/web4-terminal/pump-curve'
import type { PoolAccountSnapshot } from './types'

export function poolSnapshotToToken(pool: PoolAccountSnapshot, index: number): BondingToken {
  const emoji = EMOJIS[index % EMOJIS.length]
  const gradient = GRADIENTS[index % GRADIENTS.length]
  const virtualSol = lamportsToSol(pool.virtualSolLamports)
  const virtualToken = baseToTokens(pool.virtualTokenBase)

  return {
    mint: pool.mint,
    name: pool.name || 'Token',
    ticker: pool.symbol || 'TKN',
    description: '',
    emoji,
    gradient,
    virtualSol,
    virtualToken,
    realSolRaised: lamportsToSol(pool.realSolLamports),
    tokensSold: baseToTokens(pool.tokensSoldBase),
    volumeSol: lamportsToSol(pool.realSolLamports),
    graduated: pool.graduated,
    launchSol: 0,
    openPriceSol: virtualSol / Math.max(virtualToken, 1),
    createdAt: Date.now(),
  }
}
