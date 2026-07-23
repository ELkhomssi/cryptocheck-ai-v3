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
import {
  isPinataConfigured,
  pinLaunchImageIfDataUrl,
  pinLaunchMetadataJson,
} from './metadata-pinata'

function serializeTx(tx: VersionedTransaction | Transaction): string {
  if (tx instanceof VersionedTransaction) {
    return Buffer.from(tx.serialize()).toString('base64')
  }
  return Buffer.from(
    tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
  ).toString('base64')
}

function sanitizeSocialUrl(raw: string | undefined, kinds: 'http' | 'twitter' | 'telegram' | 'discord'): string | undefined {
  const v = (raw ?? '').trim()
  if (!v) return undefined
  try {
    if (kinds === 'twitter') {
      if (/^@?[A-Za-z0-9_]{1,15}$/.test(v)) return `https://twitter.com/${v.replace(/^@/, '')}`
      const u = new URL(v.startsWith('http') ? v : `https://${v}`)
      if (!/twitter\.com|x\.com$/i.test(u.hostname.replace(/^www\./, ''))) return undefined
      return u.toString()
    }
    if (kinds === 'telegram') {
      if (/^@?[A-Za-z0-9_]{5,32}$/.test(v)) return `https://t.me/${v.replace(/^@/, '')}`
      const u = new URL(v.startsWith('http') ? v : `https://${v}`)
      if (!/t\.me$/i.test(u.hostname.replace(/^www\./, ''))) return undefined
      return u.toString()
    }
    if (kinds === 'discord') {
      const u = new URL(v.startsWith('http') ? v : `https://${v}`)
      if (!/discord\.gg|discord\.com$/i.test(u.hostname.replace(/^www\./, ''))) return undefined
      return u.toString()
    }
    const u = new URL(v.startsWith('http') ? v : `https://${v}`)
    if (u.protocol !== 'https:') return undefined
    return u.toString()
  } catch {
    return undefined
  }
}

export type BuildLaunchResult = {
  mint: string
  poolId: string
  platformId: string
  transactions: string[]
  metadataUri: string
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
  website?: string
  twitter?: string
  telegram?: string
  discord?: string
}): Promise<BuildLaunchResult> {
  const platformId = getPlatformId()
  const programId = launchProgramId()
  const creator = new PublicKey(input.creatorWallet)
  const mintPair = Keypair.generate()
  const mintA = mintPair.publicKey
  const mintStr = mintA.toBase58()

  const website = sanitizeSocialUrl(input.website, 'http')
  const twitter = sanitizeSocialUrl(input.twitter, 'twitter')
  const telegram = sanitizeSocialUrl(input.telegram, 'telegram')
  const discord = sanitizeSocialUrl(input.discord, 'discord')

  let image = input.imageUrl
  let metadataUri = `${siteBaseUrl()}/api/launch/metadata/${mintStr}`
  let checksumSha256: string | undefined

  if (isPinataConfigured()) {
    try {
      image = await pinLaunchImageIfDataUrl(input.imageUrl)
      const pinned = await pinLaunchMetadataJson({
        name: input.name,
        symbol: input.ticker,
        description: input.description,
        image,
        external_url: website,
        extensions: {
          platform: 'CryptoCheck',
          mint: mintStr,
          ...(twitter ? { twitter } : {}),
          ...(telegram ? { telegram } : {}),
          ...(discord ? { discord } : {}),
          ...(website ? { website } : {}),
        },
      })
      metadataUri = pinned.uri
      checksumSha256 = pinned.checksumSha256
    } catch (e) {
      console.warn(
        '[build-launch] Pinata upload failed — falling back to self-hosted URI:',
        e instanceof Error ? e.message : e,
      )
    }
  }

  await stashLaunchMetadata({
    mint: mintStr,
    name: input.name,
    symbol: input.ticker,
    description: input.description,
    image,
    external_url: website,
    website,
    twitter,
    telegram,
    discord,
    metadataUri,
    checksumSha256,
  })

  const uri = metadataUri.startsWith('ipfs://')
    ? metadataUri
    : `${siteBaseUrl()}/api/launch/metadata/${mintStr}`
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
    mint: mintStr,
    poolId,
    platformId: platformId.toBase58(),
    transactions: serialized,
    metadataUri: uri,
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
