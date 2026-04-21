import { NextRequest, NextResponse } from 'next/server'
import type { HoldersResult, TokenMeta, TokenSupplyResult } from '@/lib/helius'
import { heliusRest, rpcCall } from '@/lib/helius-server'
import { withApiAuth } from '@/lib/middleware/with-api-auth'
import { scanApiErrorPayload } from '@/lib/api/scan-api-errors'
import {
  computeAcutePoolWindowEndMs,
  computeInsiderExitIndex,
  computeNeuralScoreFromExitFacts,
  isSplFullyRenounced,
  isSplMintRenounced,
  type ExitIntelFacts,
} from '@/lib/token-exit-intel'

export const dynamic = 'force-dynamic'

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

export const POST = withApiAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const mint = typeof body?.mint === 'string' ? body.mint.trim() : ''
    if (!mint || mint.length < 32) {
      return NextResponse.json(
        scanApiErrorPayload('Invalid mint address', 400, 'INVALID_MINT', {
          reason: 'INVALID_MINT',
          severity: 'low',
        }),
        { status: 400 }
      )
    }

    const [accRes, metaArr, supply, holders, dexRes] = await Promise.allSettled([
      rpcCall<ParsedMintAccount>('getAccountInfo', [mint, { encoding: 'jsonParsed' }]),
      heliusRest<TokenMeta[]>('/token-metadata', { mintAccounts: [mint] }),
      rpcCall<TokenSupplyResult>('getTokenSupply', [mint]),
      rpcCall<HoldersResult>('getTokenLargestAccounts', [mint]),
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`).then((r) => r.json()),
    ])

    const acc = accRes.status === 'fulfilled' ? accRes.value : null
    if (!acc?.value) {
      return NextResponse.json(
        scanApiErrorPayload('Mint account not found on-chain', 404, 'MINT_NOT_FOUND', {
          reason: 'MINT_NOT_FOUND',
          severity: 'low',
        }),
        { status: 404 }
      )
    }
    const parsed = acc.value.data?.parsed
    if (!parsed || parsed.type !== 'mint' || !parsed.info) {
      return NextResponse.json(
        scanApiErrorPayload('Not a valid SPL mint account', 400, 'INVALID_MINT', {
          reason: 'NOT_SPL_MINT',
          severity: 'low',
        }),
        { status: 400 }
      )
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

    const dex = dexRes.status === 'fulfilled' ? dexRes.value?.pairs?.[0] : null
    const liquidityUsd = typeof dex?.liquidity?.usd === 'number' ? dex.liquidity.usd : 0
    const volume24h = typeof dex?.volume?.h24 === 'number' ? dex.volume.h24 : 0
    const priceChange24h = typeof dex?.priceChange?.h24 === 'number' ? dex.priceChange.h24 : 0
    const buys24h = typeof dex?.txns?.h24?.buys === 'number' ? dex.txns.h24.buys : 0
    const sells24h = typeof dex?.txns?.h24?.sells === 'number' ? dex.txns.h24.sells : 0
    const rawPairCreated = typeof dex?.pairCreatedAt === 'number' ? dex.pairCreatedAt : null
    const pairCreatedAtMs =
      rawPairCreated == null
        ? null
        : rawPairCreated > 1_000_000_000_000
          ? rawPairCreated
          : rawPairCreated * 1000
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

    return NextResponse.json({
      mint,
      symbol: meta?.onChainMetadata?.metadata?.data?.symbol || meta?.legacyMetadata?.symbol || '???',
      splMintAuthority,
      splFreezeAuthority,
      metadataUpdateAuthority,
      isSplMintRenounced: isSplMintRenounced(splMintAuthority),
      isSplFullyRenounced: isSplFullyRenounced(splMintAuthority, splFreezeAuthority),
      iei,
      neuralScore,
      acutePoolWindowEndMs,
      pairCreatedAtMs,
      top1Pct,
      liquidityUsd,
      pairAgeMin,
      dexUrl: dex?.url || '',
      scannedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[token-exit-intel]', err)
    return NextResponse.json(
      scanApiErrorPayload('Upstream intelligence sources unavailable', 502, 'UPSTREAM_ERROR', {
        reason: 'UPSTREAM_ERROR',
        severity: 'high',
      }),
      { status: 502 }
    )
  }
})
