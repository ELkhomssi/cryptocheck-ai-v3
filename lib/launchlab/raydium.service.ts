/**
 * LaunchLAB ↔ Raydium Launchpad bonding-curve execution.
 * RDM_ namespace isolates Raydium SDK symbols from internal LaunchLAB naming.
 * Engine/callers import ONLY this module — never `@raydium-io/raydium-sdk-v2` directly.
 *
 * Installed SDK: `@raydium-io/raydium-sdk-v2@0.2.59-alpha`
 * Verified surface (do not assume demo-repo drift):
 *   - buyToken({ buyAmount: BN, slippage?: BN })  // slippage unit = bps (SLIPPAGE_UNIT=10000)
 *   - sellToken({ sellAmount: BN, slippage?: BN })
 *   - getRpcPoolInfo → poolInfo.status (u8): 0=Fund, 1=Migrate, 2=Migrated/Trade
 *   - PlatformConfig.feeRate (BN); SwapInfoReturn.splitFee.platformFee (BN) — no extInfo.feeAmount
 */

import 'server-only'

import {
  Raydium as RDM_Raydium,
  PlatformConfig as RDM_PlatformConfig,
  TxVersion as RDM_TxVersion,
  type Raydium as RDM_RaydiumInstance,
} from '@raydium-io/raydium-sdk-v2'
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import { NATIVE_MINT } from '@solana/spl-token'
import BN from 'bn.js'

import { getRpcUrl } from '@/lib/launch/config'
import { SNIPER_JITO_TIP_LAMPORTS } from '@/lib/launchpad/constants'
import { DEFAULT_PLATFORM_FEE_BPS } from '@/lib/revenue-dashboard/constants'
import { recordFeeRecord } from '@/lib/revenue-dashboard/fee-store'
import type { WalletLike } from '@/lib/trading/jupiter-client'
import {
  LaunchLabBlockedError,
  validateTokenRisk,
} from '@/lib/trading/risk-gated-swap'
import {
  isBondingCurveActive,
  LaunchpadMigratedError,
  LAUNCHPAD_POOL_STATUS,
  resolveLaunchpadPoolId,
  type LaunchlabCluster,
} from '@/lib/launchlab/pool'

export {
  isBondingCurveActive,
  LaunchpadMigratedError,
  LAUNCHPAD_POOL_STATUS,
  resolveLaunchpadPoolId,
}
export type { LaunchlabCluster }

const SOL_MINT = NATIVE_MINT.toBase58()

type Cluster = LaunchlabCluster

type CachedSdk = {
  key: string
  instance: RDM_RaydiumInstance
  connection: Connection
}

let sdkCache: CachedSdk | null = null

function rpcUrlForCluster(cluster: Cluster): string {
  if (cluster === 'devnet') {
    return (
      process.env.LAUNCHLAB_DEVNET_RPC_URL?.trim() ||
      process.env.SOLANA_DEVNET_RPC_URL?.trim() ||
      'https://api.devnet.solana.com'
    )
  }
  return getRpcUrl()
}

/**
 * Singleton Raydium SDK loader — connection + cluster must match (mainnet Connection
 * with cluster:'mainnet', etc.). Owner is PublicKey-only (non-custodial build).
 */
export async function initRdmSdk(params: {
  owner: PublicKey
  cluster: Cluster
}): Promise<RDM_RaydiumInstance> {
  const rpcUrl = rpcUrlForCluster(params.cluster)
  const key = `${params.cluster}:${rpcUrl}:${params.owner.toBase58()}`
  if (sdkCache?.key === key) return sdkCache.instance

  const connection = new Connection(rpcUrl, 'confirmed')
  if (connection.rpcEndpoint.includes('api.mainnet-beta.solana.com')) {
    console.warn(
      '[launchlab/raydium] using public mainnet RPC — prefer HELIUS_RPC_URL / SOLANA_RPC_URL',
    )
  }

  const instance = await RDM_Raydium.load({
    owner: params.owner,
    connection,
    cluster: params.cluster,
    disableFeatureCheck: true,
    disableLoadToken: false,
    blockhashCommitment: 'confirmed',
  })

  sdkCache = { key, instance, connection }
  return instance
}

export async function getLaunchpadPoolInfo(
  poolId: PublicKey,
  cluster: Cluster,
  owner: PublicKey = PublicKey.default,
) {
  const raydium = await initRdmSdk({ owner, cluster })
  const poolInfo = await raydium.launchpad.getRpcPoolInfo({ poolId })
  return {
    ...poolInfo,
    /** True when buys/sells on the curve are still valid. */
    onBondingCurve: isBondingCurveActive(poolInfo.status),
    /** status ≥ MIGRATE → caller must not attempt curve buy/sell. */
    migratedOffCurve: !isBondingCurveActive(poolInfo.status),
  }
}

function assertWallet(wallet: WalletLike): PublicKey {
  const pk = wallet.publicKey
  if (!pk) throw new Error('walletProvider.publicKey is required (non-custodial)')
  return new PublicKey(typeof pk === 'string' ? pk : pk.toBase58())
}

function lamportsToApproxUsd(lamports: BN, solPriceUsd = 150): number {
  const sol = Number(lamports.toString()) / 1e9
  if (!Number.isFinite(sol)) return 0
  return Math.max(0, sol * solPriceUsd)
}

/**
 * No dedicated Jito bundle helper exists in-repo (Jupiter path only passes
 * `prioritizationFeeLamports: { jitoTipLamports }` to Jupiter Swap API).
 * Config-gated tip note: SNIPER_JITO_TIP_LAMPORTS > 0 is reserved for future
 * tip-instruction wiring; submission always falls back to wallet-sign + RPC send.
 */
async function submitViaJitoOrFallback(
  transaction: Transaction | VersionedTransaction,
  walletProvider: WalletLike,
  connection: Connection,
): Promise<string> {
  void SNIPER_JITO_TIP_LAMPORTS
  const signed = await walletProvider.signTransaction(transaction)
  const raw =
    signed instanceof VersionedTransaction
      ? signed.serialize()
      : (signed as Transaction).serialize()
  const signature = await connection.sendRawTransaction(raw, {
    skipPreflight: false,
    maxRetries: 3,
  })
  await connection.confirmTransaction(signature, 'confirmed')
  return signature
}

async function gateOrThrow(params: {
  mint: string
  walletAddress: string
  amountUsd: number
  slippageBps: number
}): Promise<void> {
  const risk = await validateTokenRisk(params.mint, {
    walletAddress: params.walletAddress,
    amountUsd: params.amountUsd,
    slippageBps: params.slippageBps,
  })
  if (!risk.allowed) {
    throw new LaunchLabBlockedError(risk.reasons, risk)
  }
}

async function recordLaunchlabFee(params: {
  signature: string
  walletAddress: string
  inputMint: string
  outputMint: string
  volumeUsd: number
  feeAmountLamports: BN
  feeBps: number
}): Promise<void> {
  await recordFeeRecord({
    signature: params.signature,
    walletAddress: params.walletAddress,
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    volumeUsd: params.volumeUsd,
    feeBps: params.feeBps,
    feeAmountBase: params.feeAmountLamports.toString(),
    feeTokenAccount: '',
    executedAt: new Date().toISOString(),
    humanWalletHeuristic: 'unknown',
    source: 'launchlab-raydium-direct',
  })
}

export async function executeLaunchpadBuy(params: {
  mintAddress: PublicKey
  solAmountIn: BN
  slippageToleranceBps: number
  walletProvider: WalletLike
  cluster: Cluster
}): Promise<{ signature: string; feeAmountLamports: BN }> {
  const owner = assertWallet(params.walletProvider)
  const mint = params.mintAddress.toBase58()
  const amountUsd = lamportsToApproxUsd(params.solAmountIn)

  // 1. RISK GATE FIRST — no SDK / pool / RPC trade side-effects before this passes.
  await gateOrThrow({
    mint,
    walletAddress: owner.toBase58(),
    amountUsd,
    slippageBps: params.slippageToleranceBps,
  })

  const raydium = await initRdmSdk({ owner, cluster: params.cluster })
  const poolId = resolveLaunchpadPoolId(params.mintAddress, params.cluster)
  const poolInfo = await getLaunchpadPoolInfo(poolId, params.cluster, owner)

  if (poolInfo.migratedOffCurve) {
    throw new LaunchpadMigratedError(poolInfo.status)
  }

  const platformAcct = await raydium.connection.getAccountInfo(poolInfo.platformId)
  if (!platformAcct?.data) {
    throw new Error(`platform config missing: ${poolInfo.platformId.toBase58()}`)
  }
  const platformInfo = RDM_PlatformConfig.decode(platformAcct.data)

  // SDK 0.2.59-alpha: buyAmount (BN lamports of quote/SOL), slippage BN in bps (SLIPPAGE_UNIT=10000).
  const { transaction, extInfo } = await raydium.launchpad.buyToken({
    programId: poolInfo.programId,
    mintA: params.mintAddress,
    poolInfo,
    platformFeeRate: platformInfo.feeRate,
    buyAmount: params.solAmountIn,
    slippage: new BN(params.slippageToleranceBps),
    txVersion: RDM_TxVersion.LEGACY,
  })

  const signature = await submitViaJitoOrFallback(
    transaction,
    params.walletProvider,
    raydium.connection,
  )

  // Installed SDK: fee is extInfo.splitFee.platformFee (BN) — not extInfo.feeAmount.
  const feeAmountLamports = extInfo.splitFee?.platformFee ?? new BN(0)
  // feeRate style in createPlatformConfig: 1000 ≈ 1% → ≈ 100 bps; fall back to dashboard default.
  const feeBps =
    platformInfo.feeRate && !platformInfo.feeRate.isZero()
      ? Math.max(1, Math.round(platformInfo.feeRate.toNumber() / 10))
      : DEFAULT_PLATFORM_FEE_BPS

  await recordLaunchlabFee({
    signature,
    walletAddress: owner.toBase58(),
    inputMint: SOL_MINT,
    outputMint: mint,
    volumeUsd: amountUsd,
    feeAmountLamports,
    feeBps,
  })

  return { signature, feeAmountLamports }
}

export async function executeLaunchpadSell(params: {
  mintAddress: PublicKey
  /** Base-token amount to sell (mintA atomic units), BN. */
  tokenAmountIn: BN
  slippageToleranceBps: number
  walletProvider: WalletLike
  cluster: Cluster
  /** Optional: approximate USD for whale/risk gate (sells still hard-block DANGER). */
  amountUsd?: number
}): Promise<{ signature: string; feeAmountLamports: BN }> {
  const owner = assertWallet(params.walletProvider)
  const mint = params.mintAddress.toBase58()
  const amountUsd = params.amountUsd ?? 1

  await gateOrThrow({
    mint,
    walletAddress: owner.toBase58(),
    amountUsd,
    slippageBps: params.slippageToleranceBps,
  })

  const raydium = await initRdmSdk({ owner, cluster: params.cluster })
  const poolId = resolveLaunchpadPoolId(params.mintAddress, params.cluster)
  const poolInfo = await getLaunchpadPoolInfo(poolId, params.cluster, owner)

  if (poolInfo.migratedOffCurve) {
    throw new LaunchpadMigratedError(poolInfo.status)
  }

  const platformAcct = await raydium.connection.getAccountInfo(poolInfo.platformId)
  if (!platformAcct?.data) {
    throw new Error(`platform config missing: ${poolInfo.platformId.toBase58()}`)
  }
  const platformInfo = RDM_PlatformConfig.decode(platformAcct.data)

  // SDK 0.2.59-alpha: sellToken({ sellAmount, slippage?: BN }) → extInfo: { outAmount: BN }
  const { transaction } = await raydium.launchpad.sellToken({
    programId: poolInfo.programId,
    mintA: params.mintAddress,
    poolInfo,
    platformFeeRate: platformInfo.feeRate,
    sellAmount: params.tokenAmountIn,
    slippage: new BN(params.slippageToleranceBps),
    txVersion: RDM_TxVersion.LEGACY,
  })

  const signature = await submitViaJitoOrFallback(
    transaction,
    params.walletProvider,
    raydium.connection,
  )

  // SDK 0.2.59-alpha sellToken extInfo is `{ outAmount: BN }` only (no splitFee on sell path).
  const feeAmountLamports = new BN(0)
  const feeBps =
    platformInfo.feeRate && !platformInfo.feeRate.isZero()
      ? Math.max(1, Math.round(platformInfo.feeRate.toNumber() / 10))
      : DEFAULT_PLATFORM_FEE_BPS

  await recordLaunchlabFee({
    signature,
    walletAddress: owner.toBase58(),
    inputMint: mint,
    outputMint: SOL_MINT,
    volumeUsd: amountUsd,
    feeAmountLamports,
    feeBps,
  })

  return { signature, feeAmountLamports }
}

/** Thin surface for LaunchLAB engine — never import raydium-sdk-v2 elsewhere. */
export const raydiumLaunchlabService = {
  resolveLaunchpadPoolId,
  getLaunchpadPoolInfo,
  executeLaunchpadBuy,
  executeLaunchpadSell,
} as const
