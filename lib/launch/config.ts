import {
  DEVNET_PROGRAM_ID,
  LAUNCHPAD_PROGRAM,
  LaunchpadPoolInitParam,
} from '@raydium-io/raydium-sdk-v2'
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { LAUNCH_DECIMALS, MIN_SOL_TARGET } from './constants'

export {
  LAUNCH_DECIMALS,
  MIN_SELL_FRACTION,
  MIN_SOL_TARGET,
  MIN_SUPPLY_HUMAN,
} from './constants'

/**
 * LaunchLab PlatformConfig fee rates use FEE_RATE_DENOMINATOR = 1_000_000.
 * Market-norm split (not “keep it all”):
 * - platformFeeRate 10_000 = 1.0% of curve trade volume → platform claim wallet
 * - creatorFeeRate  5_000  = 0.5% of curve trade volume → token creator
 * Post-migrate LP NFT split remains platform 40% / creator 50% / burn 10%
 * (see scripts/create-platform.ts migrateCpLockNftScale).
 */
export const PLATFORM_FEE_RATE = new BN(10_000)
export const CREATOR_FEE_RATE = new BN(5_000)

export function launchCluster(): 'mainnet' | 'devnet' {
  const raw = (process.env.LAUNCHLAB_CLUSTER ?? 'devnet').trim().toLowerCase()
  return raw === 'mainnet' || raw === 'mainnet-beta' ? 'mainnet' : 'devnet'
}

export function launchProgramId(): PublicKey {
  return launchCluster() === 'devnet'
    ? DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM
    : LAUNCHPAD_PROGRAM
}

export function getPlatformId(): PublicKey {
  const cluster = launchCluster()
  const id =
    cluster === 'devnet'
      ? process.env.LAUNCHLAB_PLATFORM_ID_DEVNET?.trim() ||
        process.env.LAUNCHLAB_PLATFORM_ID?.trim()
      : process.env.LAUNCHLAB_PLATFORM_ID_MAINNET?.trim() ||
        process.env.LAUNCHLAB_PLATFORM_ID?.trim()
  if (!id) {
    throw new Error(
      cluster === 'devnet'
        ? 'LAUNCHLAB_PLATFORM_ID_DEVNET (or LAUNCHLAB_PLATFORM_ID) is not set.'
        : 'LAUNCHLAB_PLATFORM_ID_MAINNET (or LAUNCHLAB_PLATFORM_ID) is not set.',
    )
  }
  return new PublicKey(id)
}

export function getCpConfigId(): PublicKey {
  const cluster = launchCluster()
  const id =
    cluster === 'devnet'
      ? process.env.LAUNCHLAB_CP_CONFIG_ID_DEVNET?.trim() ||
        process.env.LAUNCHLAB_CP_CONFIG_ID?.trim()
      : process.env.LAUNCHLAB_CP_CONFIG_ID_MAINNET?.trim() ||
        process.env.LAUNCHLAB_CP_CONFIG_ID?.trim()
  if (!id) {
    throw new Error(
      cluster === 'devnet'
        ? 'LAUNCHLAB_CP_CONFIG_ID_DEVNET (or LAUNCHLAB_CP_CONFIG_ID) is not set.'
        : 'LAUNCHLAB_CP_CONFIG_ID_MAINNET (or LAUNCHLAB_CP_CONFIG_ID) is not set.',
    )
  }
  return new PublicKey(id)
}

export function getRpcUrl(): string {
  const cluster = launchCluster()
  if (cluster === 'devnet') {
    return (
      process.env.LAUNCHLAB_DEVNET_RPC_URL?.trim() ||
      process.env.SOLANA_DEVNET_RPC_URL?.trim() ||
      'https://api.devnet.solana.com'
    )
  }
  return (
    process.env.HELIUS_RPC_URL?.trim() ||
    process.env.SOLANA_RPC_URL?.trim() ||
    'https://api.mainnet-beta.solana.com'
  )
}

export function siteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
}

/** JustSendIt-style safe defaults (Raydium LaunchpadPoolInitParam), with SOL target clamp. */
export function justSendItParams(solTarget: number): {
  supply: BN
  totalSellA: BN
  totalFundRaisingB: BN
  decimals: number
} {
  const sol = Math.max(solTarget, MIN_SOL_TARGET)
  return {
    supply: LaunchpadPoolInitParam.supply.clone(),
    totalSellA: LaunchpadPoolInitParam.totalSellA.clone(),
    totalFundRaisingB: new BN(Math.floor(sol * 1e9)),
    decimals: LAUNCH_DECIMALS,
  }
}

export function humanToBaseUnits(human: number, decimals = LAUNCH_DECIMALS): BN {
  if (!Number.isFinite(human) || human < 0) throw new Error('amount must be ≥ 0')
  if (human === 0) return new BN(0)
  const factor = new BN(10).pow(new BN(decimals))
  return new BN(Math.floor(human)).mul(factor)
}
