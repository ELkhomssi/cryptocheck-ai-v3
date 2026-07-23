import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  CREATOR_FEE_RATE,
  getRpcUrl,
  launchCluster,
  PLATFORM_FEE_RATE,
} from './config'
import { LAUNCH_DECIMALS } from './constants'
import type { LaunchFeeBreakdown } from './types'

export type { LaunchFeeBreakdown } from './types'

/** FEE_RATE_DENOMINATOR used by Raydium LaunchLab PlatformConfig. */
export const FEE_RATE_DENOMINATOR = 1_000_000

/**
 * Typical account rent for a Raydium createLaunchpad (createOnly) on Solana.
 * Measured from SDK account set: mint + metadata + pool + vaults + ATAs.
 * Recalculated live when possible; this is the documented floor for UI.
 */
export const ESTIMATED_CREATE_RENT_LAMPORTS = 18_500_000 // ~0.0185 SOL

/** Base priority + signature fees for ~2 versioned txs (conservative). */
export const ESTIMATED_NETWORK_FEE_LAMPORTS = 25_000

/** Platform does not skim a separate create fee — curve fees apply on trades. */
export const CREATION_PLATFORM_FEE_LAMPORTS = 0

function rateToApproxBps(rate: { toNumber(): number }): number {
  return Math.round((rate.toNumber() / FEE_RATE_DENOMINATOR) * 10_000)
}

export async function estimateLaunchFees(input?: {
  creatorWallet?: string
  metadataProvider?: 'ipfs' | 'self-hosted'
}): Promise<LaunchFeeBreakdown> {
  const cluster = launchCluster()
  const connection = new Connection(getRpcUrl(), 'confirmed')

  let rentLamports = ESTIMATED_CREATE_RENT_LAMPORTS
  try {
    // Mint (82) + Token metadata (~679) + 2 vaults (~165 each) approximation via rent-exempt.
    const mintRent = await connection.getMinimumBalanceForRentExemption(82)
    const metaRent = await connection.getMinimumBalanceForRentExemption(679)
    const vaultRent = await connection.getMinimumBalanceForRentExemption(165)
    rentLamports = mintRent + metaRent + vaultRent * 2 + ESTIMATED_CREATE_RENT_LAMPORTS * 0.35
    rentLamports = Math.ceil(rentLamports)
  } catch {
    // keep documented floor
  }

  const metadataCostSol =
    input?.metadataProvider === 'ipfs' && process.env.PINATA_JWT?.trim() ? 0 : 0

  const platformCreateFeeSol = CREATION_PLATFORM_FEE_LAMPORTS / LAMPORTS_PER_SOL
  const networkFeeSol = ESTIMATED_NETWORK_FEE_LAMPORTS / LAMPORTS_PER_SOL
  const rentSol = rentLamports / LAMPORTS_PER_SOL
  const totalSol = platformCreateFeeSol + networkFeeSol + rentSol + metadataCostSol

  let walletBalanceSol: number | null = null
  let sufficientBalance: boolean | null = null
  if (input?.creatorWallet) {
    try {
      const pk = new PublicKey(input.creatorWallet)
      const lamports = await connection.getBalance(pk, 'confirmed')
      walletBalanceSol = lamports / LAMPORTS_PER_SOL
      sufficientBalance = walletBalanceSol >= totalSol + 0.002 // leave dust for ATA rent drift
    } catch {
      walletBalanceSol = null
      sufficientBalance = null
    }
  }

  const platformRate = PLATFORM_FEE_RATE.toNumber()
  const creatorRate = CREATOR_FEE_RATE.toNumber()

  return {
    cluster,
    decimals: LAUNCH_DECIMALS,
    platformCreateFeeSol,
    networkFeeSol,
    rentSol,
    metadataCostSol,
    totalSol,
    lines: [
      {
        id: 'platform_create',
        label: 'Platform create fee',
        sol: platformCreateFeeSol,
        note: 'No create skim — platform earns 1.0% of bonding-curve volume',
      },
      {
        id: 'network',
        label: 'Network fee (est.)',
        sol: networkFeeSol,
        note: 'Signature + priority fees for VersionedTransactions',
      },
      {
        id: 'rent',
        label: 'Account rent (est.)',
        sol: rentSol,
        note: 'Refundable rent-exempt deposits for mint, metadata, vaults',
      },
      {
        id: 'metadata',
        label: 'Metadata hosting',
        sol: metadataCostSol,
        note:
          process.env.PINATA_JWT?.trim()
            ? 'IPFS via Pinata (included)'
            : 'Self-hosted JSON URI via CryptoCheck API',
      },
      {
        id: 'total',
        label: 'Estimated total',
        sol: totalSol,
      },
    ],
    curveFees: {
      platformFeeBpsApprox: rateToApproxBps(PLATFORM_FEE_RATE),
      creatorFeeBpsApprox: rateToApproxBps(CREATOR_FEE_RATE),
      platformFeeRate: platformRate,
      creatorFeeRate: creatorRate,
      denominator: FEE_RATE_DENOMINATOR,
      note: 'Charged on bonding-curve buys/sells after launch — not at create time.',
    },
    walletBalanceSol,
    sufficientBalance,
    estimatedAt: new Date().toISOString(),
  }
}
