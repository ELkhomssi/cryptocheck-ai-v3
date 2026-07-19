import 'server-only'

import {
  getPdaLaunchpadConfigId,
  LaunchpadConfig,
  PlatformConfig,
  TxVersion,
} from '@raydium-io/raydium-sdk-v2'
import { NATIVE_MINT } from '@solana/spl-token'
import {
  Keypair,
  PublicKey,
  VersionedTransaction,
  type Transaction,
} from '@solana/web3.js'
import BN from 'bn.js'
import { getPlatformId, getRpcUrl, launchCluster, launchProgramId, siteBaseUrl } from './config'
import type { ResolvedCurveParams } from './curve-params'
import { initSdk } from './raydium-sdk'
import { stashLaunchMetadata } from './metadata-store'

function serializeTx(tx: VersionedTransaction | Transaction): string {
  if (tx instanceof VersionedTransaction) {
    return Buffer.from(tx.serialize()).toString('base64')
  }
  return Buffer.from(
    tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
  ).toString('base64')
}

export type BuildLaunchResult = {
  mint: string
  poolId: string
  platformId: string
  transactions: string[]
  params: {
    name: string
    ticker: string
    supply: string
    totalSellA: string
    totalFundRaisingB: string
    decimals: number
    migrateType: 'cpmm'
    solTarget: number
  }
}

/**
 * Build LaunchLab createLaunchpad txs under OUR platformId.
 * Mint keypair is generated server-side and used only as an ephemeral extraSigner
 * (partial-sign). User wallet must still sign — platform never signs as fee payer.
 */
export async function buildLaunchTransactions(input: {
  name: string
  ticker: string
  description: string
  imageUrl: string
  creatorWallet: string
  curve: ResolvedCurveParams
}): Promise<BuildLaunchResult> {
  const platformId = getPlatformId()
  const programId = launchProgramId()
  const creator = new PublicKey(input.creatorWallet)
  const mintPair = Keypair.generate()
  const mintA = mintPair.publicKey

  await stashLaunchMetadata({
    mint: mintA.toBase58(),
    name: input.name,
    symbol: input.ticker,
    description: input.description,
    image: input.imageUrl,
  })

  const uri = `${siteBaseUrl()}/api/launch/metadata/${mintA.toBase58()}`
  const configId = getPdaLaunchpadConfigId(programId, NATIVE_MINT, 0, 0).publicKey

  const raydium = await initSdk({
    owner: creator,
    rpcUrl: getRpcUrl(),
    cluster: launchCluster(),
  })

  const configData = await raydium.connection.getAccountInfo(configId)
  if (!configData) {
    throw new Error(
      `Launchpad config not found on ${launchCluster()} (${configId.toBase58()}). Use LAUNCHLAB_CLUSTER=devnet for testing.`,
    )
  }
  const configInfo = LaunchpadConfig.decode(configData.data)

  // Confirm platform PDA exists and matches env.
  const platformInfo = await raydium.connection.getAccountInfo(platformId)
  if (!platformInfo) {
    throw new Error(`Platform PDA ${platformId.toBase58()} not found on ${launchCluster()}`)
  }
  PlatformConfig.decode(platformInfo.data)

  const { transactions, extInfo } = await raydium.launchpad.createLaunchpad({
    programId,
    mintA,
    decimals: input.curve.decimals,
    name: input.name,
    symbol: input.ticker,
    uri,
    migrateType: 'cpmm',
    configId,
    configInfo,
    platformId,
    supply: input.curve.supply,
    totalSellA: input.curve.totalSellA,
    totalFundRaisingB: input.curve.totalFundRaisingB,
    totalLockedAmount: input.curve.totalLockedAmount,
    cliffPeriod: input.curve.cliffPeriod,
    unlockPeriod: input.curve.unlockPeriod,
    txVersion: TxVersion.V0,
    buyAmount: new BN(0),
    createOnly: true,
    extraSigners: [mintPair],
    feePayer: creator,
  })

  const txs = (transactions ?? []) as (VersionedTransaction | Transaction)[]
  if (!txs.length) {
    throw new Error('Raydium SDK returned no transactions')
  }

  const serialized = txs.map(serializeTx)
  const poolId =
    (extInfo as { address?: { poolId?: PublicKey } })?.address?.poolId?.toBase58?.() ??
    (extInfo as { poolId?: PublicKey })?.poolId?.toBase58?.() ??
    ''

  const solTarget = input.curve.totalFundRaisingB.toNumber() / 1e9

  return {
    mint: mintA.toBase58(),
    poolId,
    platformId: platformId.toBase58(),
    transactions: serialized,
    params: {
      name: input.name,
      ticker: input.ticker,
      supply: input.curve.supply.toString(),
      totalSellA: input.curve.totalSellA.toString(),
      totalFundRaisingB: input.curve.totalFundRaisingB.toString(),
      decimals: input.curve.decimals,
      migrateType: 'cpmm',
      solTarget,
    },
  }
}
