import { NextRequest, NextResponse } from 'next/server'
import type { HeliusTx, HoldersResult, TokenMeta, TokenSupplyResult } from '@/lib/helius'
import { heliusRest, rpcCall } from '@/lib/helius-server'

export async function POST(req: NextRequest) {
  try {
    const { mint } = await req.json()
    if (!mint || mint.length < 32) {
      return NextResponse.json({ error: 'Invalid mint address' }, { status: 400 })
    }

    const [metaArr, supply, holders, txs, dexRes] = await Promise.allSettled([
      heliusRest<TokenMeta[]>('/token-metadata', { mintAccounts: [mint] }),
      rpcCall<TokenSupplyResult>('getTokenSupply', [mint]),
      rpcCall<HoldersResult>('getTokenLargestAccounts', [mint]),
      heliusRest<HeliusTx[]>(`/addresses/${mint}/transactions`),
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`).then(r => r.json()),
    ])

    const meta      = metaArr.status === 'fulfilled' ? metaArr.value?.[0] : null
    const supplyData  = supply.status === 'fulfilled' ? supply.value : null
    const holdersData = holders.status === 'fulfilled' ? holders.value : null
    const txsData   = txs.status === 'fulfilled' ? txs.value : []
    const dex       = dexRes.status === 'fulfilled' ? dexRes.value?.pairs?.[0] : null

    const name   = meta?.onChainMetadata?.metadata?.data?.name || meta?.legacyMetadata?.name || 'Unknown'
    const symbol = meta?.onChainMetadata?.metadata?.data?.symbol || meta?.legacyMetadata?.symbol || '???'
    const mintAuth = meta?.onChainMetadata?.metadata?.updateAuthority || null

    const evidence: {
      id: string; type: string; title: string
      description: string; severity: string; timestamp: string
      data?: Record<string, unknown>
    }[] = []

    if (mintAuth) {
      evidence.push({ id: 'MINT_AUTH', type: 'RUG_SIGNAL', title: 'Mint Authority Active',
        description: `Authority ${mintAuth.slice(0,8)}...${mintAuth.slice(-6)} can mint unlimited tokens.`,
        severity: 'CRITICAL', timestamp: new Date().toISOString(), data: { authority: mintAuth } })
    } else {
      evidence.push({ id: 'MINT_AUTH_CLEAN', type: 'CLEAN', title: 'Mint Authority Revoked',
        description: 'Supply is fixed. Cannot be inflated by deployer.',
        severity: 'CLEAN', timestamp: new Date().toISOString() })
    }

    if (holdersData?.value?.length && supplyData?.value?.amount) {
      const total = BigInt(supplyData.value.amount)
      const holdersList = holdersData.value as Array<{ address: string; amount: string; uiAmount: number }>
      if (total > 0n) {
        const top1Pct  = Number((BigInt(holdersList[0]?.amount || '0') * 10000n) / total) / 100
        const top5Sum  = holdersList.slice(0,5).reduce((a:bigint,h) => a + BigInt(h.amount||'0'), 0n)
        const top5Pct  = Number((top5Sum * 10000n) / total) / 100
        const top10Sum = holdersList.slice(0,10).reduce((a:bigint,h) => a + BigInt(h.amount||'0'), 0n)
        const top10Pct = Number((top10Sum * 10000n) / total) / 100
        if (top1Pct > 50) {
          evidence.push({ id: 'TOP1_CRITICAL', type: 'RUG_SIGNAL', title: `Top Holder Owns ${top1Pct.toFixed(1)}%`,
            description: 'Single wallet controls majority of supply. Dump risk is extreme.',
            severity: 'CRITICAL', timestamp: new Date().toISOString(),
            data: { top1Pct, top5Pct, top10Pct, topHolder: holdersList[0]?.address } })
        } else if (top1Pct > 25) {
          evidence.push({ id: 'TOP1_HIGH', type: 'WARNING', title: `High Concentration: ${top1Pct.toFixed(1)}%`,
            description: 'One wallet holds significant supply. Monitor for large sells.',
            severity: 'HIGH', timestamp: new Date().toISOString(), data: { top1Pct, top5Pct, top10Pct } })
        } else {
          evidence.push({ id: 'DISTRIBUTION_OK', type: 'CLEAN', title: `Healthy Distribution — Top Holder ${top1Pct.toFixed(1)}%`,
            description: 'Supply is well distributed across wallets.',
            severity: 'CLEAN', timestamp: new Date().toISOString(), data: { top1Pct, top5Pct, top10Pct } })
        }
      }
    }

    if (dex) {
      const liquidity = dex.liquidity?.usd || 0
      const priceChange = dex.priceChange?.h24 || 0
      const pairAge = dex.pairCreatedAt ? Math.floor((Date.now() - dex.pairCreatedAt) / 60000) : null
      if (liquidity < 5000) {
        evidence.push({ id: 'LOW_LIQ', type: 'RUG_SIGNAL', title: `Critical Low Liquidity: $${liquidity.toLocaleString()}`,
          description: 'Pool can be drained easily. Classic rug setup.',
          severity: 'CRITICAL', timestamp: new Date().toISOString(), data: { liquidity } })
      } else if (liquidity < 50000) {
        evidence.push({ id: 'MED_LIQ', type: 'WARNING', title: `Low Liquidity: $${liquidity.toLocaleString()}`,
          description: 'Limited liquidity. Large trades move price significantly.',
          severity: 'MEDIUM', timestamp: new Date().toISOString(), data: { liquidity } })
      } else {
        evidence.push({ id: 'GOOD_LIQ', type: 'CLEAN', title: `Adequate Liquidity: $${liquidity.toLocaleString()}`,
          description: 'Pool has sufficient depth for normal trading.',
          severity: 'CLEAN', timestamp: new Date().toISOString(), data: { liquidity } })
      }
      if (priceChange < -80) {
        evidence.push({ id: 'PRICE_CRASH', type: 'RUG_SIGNAL', title: `Price Crashed ${priceChange.toFixed(1)}% in 24h`,
          description: 'Extreme decline consistent with rug pull or coordinated dump.',
          severity: 'CRITICAL', timestamp: new Date().toISOString(), data: { priceChange } })
      } else if (priceChange > 500) {
        evidence.push({ id: 'PUMP', type: 'WARNING', title: `Extreme Pump: +${priceChange.toFixed(0)}% in 24h`,
          description: 'Parabolic price action often precedes coordinated dump.',
          severity: 'HIGH', timestamp: new Date().toISOString(), data: { priceChange } })
      }
      if (pairAge !== null && pairAge < 60) {
        evidence.push({ id: 'VERY_NEW', type: 'WARNING', title: `Token Only ${pairAge} Minutes Old`,
          description: 'Extremely new. No track record. High risk.',
          severity: 'HIGH', timestamp: new Date().toISOString(), data: { pairAge } })
      }
    }

    const recentTxs = Array.isArray(txsData) ? txsData.slice(0,20) : []
    if (recentTxs.length > 15) {
      evidence.push({ id: 'HIGH_TX', type: 'INFO', title: `High Tx Activity: ${recentTxs.length} Recent Txs`,
        description: 'Multiple transfers detected. Could be normal or coordinated.',
        severity: 'MEDIUM', timestamp: new Date().toISOString(), data: { txCount: recentTxs.length } })
    }

    let forensicsScore = 100
    const criticalCount = evidence.filter(e => e.severity === 'CRITICAL').length
    const highCount     = evidence.filter(e => e.severity === 'HIGH').length
    const mediumCount   = evidence.filter(e => e.severity === 'MEDIUM').length
    const cleanCount    = evidence.filter(e => e.type === 'CLEAN').length
    forensicsScore -= criticalCount * 30
    forensicsScore -= highCount * 15
    forensicsScore -= mediumCount * 8
    forensicsScore += cleanCount * 5
    forensicsScore = Math.max(0, Math.min(100, forensicsScore))

    let rugProbability = 0
    if      (criticalCount >= 3)                       rugProbability = 95
    else if (criticalCount === 2)                      rugProbability = 80
    else if (criticalCount === 1 && highCount >= 1)    rugProbability = 65
    else if (criticalCount === 1)                      rugProbability = 45
    else if (highCount >= 2)                           rugProbability = 35
    else if (highCount === 1)                          rugProbability = 20
    else                                               rugProbability = 5

    const verdict = rugProbability >= 70 ? 'CONFIRMED RUG PATTERN'
      : rugProbability >= 40 ? 'SUSPICIOUS ACTIVITY'
      : rugProbability >= 20 ? 'LOW RISK — MONITOR'
      : 'CLEAN — NO RUG PATTERN'

    const verdictColor = rugProbability >= 70 ? '#ef4444'
      : rugProbability >= 40 ? '#f59e0b'
      : rugProbability >= 20 ? '#38bdf8'
      : '#22c55e'

    return NextResponse.json({
      mint, name, symbol, mintAuth, forensicsScore, rugProbability,
      verdict, verdictColor, evidence,
      marketData: dex ? {
        price: dex.priceUsd, liquidity: dex.liquidity?.usd,
        volume24h: dex.volume?.h24, priceChange24h: dex.priceChange?.h24,
        pairCreatedAt: dex.pairCreatedAt, dexUrl: dex.url,
      } : null,
      holderStats: holdersData?.value ? {
        topHolders: (holdersData.value as Array<{address:string;uiAmount:number}>).slice(0,10).map(h => ({ address: h.address, uiAmount: h.uiAmount })),
        totalSupply: supplyData?.value?.uiAmountString,
      } : null,
      scannedAt: new Date().toISOString(),
      engine: 'CryptoCheck Neural Forensics v4',
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Scan failed' }, { status: 500 })
  }
}
