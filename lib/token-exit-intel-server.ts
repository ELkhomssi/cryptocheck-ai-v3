import 'server-only'

import type { HoldersResult, TokenMeta, TokenSupplyResult } from '@/lib/helius'
import { heliusRest, rpcCall } from '@/lib/helius-server'
import {
  computeAcutePoolWindowEndMs,
  computeInsiderExitIndex,
  computeNeuralScoreFromExitFacts,
  isSplFullyRenounced,
  isSplMintRenounced,
  type ExitIntelFacts,
} from '@/lib/token-exit-intel'

type ParsedMintAccount = {
  value: {
    data: {
      parsed: {
        type: string
        info: {
          mintAuthority?: string | null
          freezeAuthority?: string | null
          decimals?: number
          supply?: string
        }
      }
    }
  } | null
}

export type TokenExitIntelSnapshot = {
  mint: string
  symbol: string
  facts: ExitIntelFacts
  iei: number
  neuralScore: number
  acutePoolWindowEndMs: number | null
  splMintAuthority: string | null
  splFreezeAuthority: string | null
  metadataUpdateAuthority: string | null
  isSplMintRenounced: boolean
  isSplFullyRenounced: boolean
  holderTokenAccounts: Array<{ address: string; amount: string; uiAmount: number }>
  dexPair: Record<string, unknown> | null
  dexUrl: string
  pairAddress: string | null
}

export type TokenExitIntelError = { code: 'INVALID_MINT' | 'MINT_NOT_FOUND' | 'NOT_SPL_MINT' | 'UPSTREAM'; message: string }

export async function fetchTokenExitIntelSnapshot(
  mint: string
): Promise<{ ok: true; data: TokenExitIntelSnapshot } | { ok: false; error: TokenExitIntelError }> {
  const trimmed = mint.trim()
  if (!trimmed || trimmed.length < 32) {
    return { ok: false, error: { code: 'INVALID_MINT', message: 'Invalid mint address' } }
  }

  const [accRes, metaArr, supply, holders, dexRes] = await Promise.allSettled([
    rpcCall<ParsedMintAccount>('getAccountInfo', [trimmed, { encoding: 'jsonParsed' }]),
    heliusRest<TokenMeta[]>('/token-metadata', { mintAccounts: [trimmed] }),
    rpcCall<TokenSupplyResult>('getTokenSupply', [trimmed]),
    rpcCall<HoldersResult>('getTokenLargestAccounts', [trimmed]),
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${trimmed}`).then((r) => r.json()),
  ])

  const acc = accRes.status === 'fulfilled' ? accRes.value : null
  if (!acc?.value) {
    return { ok: false, error: { code: 'MINT_NOT_FOUND', message: 'Mint account not found on-chain' } }
  }
  const parsed = acc.value.data?.parsed
  if (!parsed || parsed.type !== 'mint' || !parsed.info) {
    return { ok: false, error: { code: 'NOT_SPL_MINT', message: 'Not a valid SPL mint account' } }
  }

  const splMintAuthority =
    parsed.info.mintAuthority === undefined || parsed.info.mintAuthority === null
      ? null
      : String(parsed.info.mintAuthority)
  const splFreezeAuthority =
    parsed.info.freezeAuthority === undefined || parsed.info.freezeAuthority === null
      ? null
      : String(parsed.info.freezeAuthority)

  const meta = metaArr.status === 'fulfilled' ? metaArr.value?.[0] : null
  const metadataUpdateAuthority =
    meta?.onChainMetadata?.metadata?.updateAuthority != null
      ? String(meta.onChainMetadata.metadata.updateAuthority)
      : null

  const sup = supply.status === 'fulfilled' ? supply.value : null
  const hold = holders.status === 'fulfilled' ? holders.value : null
  const holderList = (hold?.value ?? []) as Array<{ address: string; amount: string; uiAmount: number }>
  const totalSupplyRaw = sup?.value?.amount || '0'
  const total = BigInt(totalSupplyRaw || '0')
  let top1Pct = 0
  if (total > 0n && holderList.length) {
    top1Pct = Number((BigInt(holderList[0]?.amount || '0') * 10000n) / total) / 100
  }

  const dex = dexRes.status === 'fulfilled' ? ((dexRes.value as { pairs?: unknown[] })?.pairs?.[0] as Record<string, unknown> | undefined) ?? null : null
  const liquidityUsd =
    dex && typeof (dex.liquidity as { usd?: number })?.usd === 'number' ? (dex.liquidity as { usd: number }).usd : 0
  const volume24h = dex && typeof (dex.volume as { h24?: number })?.h24 === 'number' ? (dex.volume as { h24: number }).h24 : 0
  const priceChange24h =
    dex && typeof (dex.priceChange as { h24?: number })?.h24 === 'number' ? (dex.priceChange as { h24: number }).h24 : 0
  const buys24h =
    dex && typeof (dex.txns as { h24?: { buys?: number } })?.h24?.buys === 'number'
      ? (dex.txns as { h24: { buys: number } }).h24.buys
      : 0
  const sells24h =
    dex && typeof (dex.txns as { h24?: { sells?: number } })?.h24?.sells === 'number'
      ? (dex.txns as { h24: { sells: number } }).h24.sells
      : 0
  const rawPairCreated = typeof dex?.pairCreatedAt === 'number' ? dex.pairCreatedAt : null
  const pairCreatedAtMs =
    rawPairCreated == null ? null : rawPairCreated > 1_000_000_000_000 ? rawPairCreated : rawPairCreated * 1000
  const pairAgeMin =
    pairCreatedAtMs != null ? Math.max(0, Math.floor((Date.now() - pairCreatedAtMs) / 60000)) : null

  const facts: ExitIntelFacts = {
    splMintAuthority,
    splFreezeAuthority,
    metadataUpdateAuthority,
    top1Pct,
    liquidityUsd,
    volume24h,
    priceChange24h,
    buys24h,
    sells24h,
    pairAgeMin,
    pairCreatedAtMs,
  }

  const iei = computeInsiderExitIndex(facts)
  const neuralScore = computeNeuralScoreFromExitFacts(facts)
  const acutePoolWindowEndMs = computeAcutePoolWindowEndMs(pairCreatedAtMs)
  const pairAddress = typeof dex?.pairAddress === 'string' ? dex.pairAddress : null
  const dexUrl = typeof dex?.url === 'string' ? dex.url : ''

  return {
    ok: true,
    data: {
      mint: trimmed,
      symbol: meta?.onChainMetadata?.metadata?.data?.symbol || meta?.legacyMetadata?.symbol || '???',
      facts,
      iei,
      neuralScore,
      acutePoolWindowEndMs,
      splMintAuthority,
      splFreezeAuthority,
      metadataUpdateAuthority,
      isSplMintRenounced: isSplMintRenounced(splMintAuthority),
      isSplFullyRenounced: isSplFullyRenounced(splMintAuthority, splFreezeAuthority),
      holderTokenAccounts: holderList,
      dexPair: dex ?? null,
      dexUrl,
      pairAddress,
    },
  }
}

/** Map SPL token account addresses → owner wallet (best-effort). */
export async function resolveTokenAccountOwners(tokenAccountAddrs: string[]): Promise<(string | null)[]> {
  if (!tokenAccountAddrs.length) return []
  const owners: (string | null)[] = []
  const chunkSize = 20
  for (let i = 0; i < tokenAccountAddrs.length; i += chunkSize) {
    const chunk = tokenAccountAddrs.slice(i, i + chunkSize)
    const res = await rpcCall<{
      value: Array<{
        data?: { parsed?: { type?: string; info?: { owner?: string } } } | null
      } | null>
    }>('getMultipleAccounts', [chunk, { encoding: 'jsonParsed' }])
    for (const cell of res?.value ?? []) {
      const t = cell?.data?.parsed?.type
      const owner = cell?.data?.parsed?.info?.owner
      if (owner && t === 'account') {
        owners.push(String(owner))
      } else {
        owners.push(null)
      }
    }
  }
  return owners
}
