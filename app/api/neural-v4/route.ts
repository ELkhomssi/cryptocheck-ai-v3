import { NextRequest, NextResponse } from 'next/server'
import type { HeliusTx, HoldersResult, TokenMeta, TokenSupplyResult } from '@/lib/helius'
import { heliusRest, rpcCall } from '@/lib/helius-server'

export async function POST(req: NextRequest) {
  try {
    const { mint } = await req.json()
    if (!mint || mint.length < 32) return NextResponse.json({ error: 'Invalid mint' }, { status: 400 })

    const [metaArr, supply, holders, txs, dexRes] = await Promise.allSettled([
      heliusRest<TokenMeta[]>('/token-metadata', { mintAccounts: [mint] }),
      rpcCall<TokenSupplyResult>('getTokenSupply', [mint]),
      rpcCall<HoldersResult>('getTokenLargestAccounts', [mint]),
      heliusRest<HeliusTx[]>(`/addresses/${mint}/transactions`),
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`).then(r => r.json()),
    ])

    const meta   = metaArr.status === 'fulfilled' ? metaArr.value?.[0] : null
    const sup    = supply.status === 'fulfilled' ? supply.value : null
    const hold   = holders.status === 'fulfilled' ? holders.value : null
    const txList = txs.status === 'fulfilled' && Array.isArray(txs.value) ? txs.value : []
    const dex    = dexRes.status === 'fulfilled' ? dexRes.value?.pairs?.[0] : null

    const name     = meta?.onChainMetadata?.metadata?.data?.name   || meta?.legacyMetadata?.name   || 'Unknown'
    const symbol   = meta?.onChainMetadata?.metadata?.data?.symbol || meta?.legacyMetadata?.symbol || '???'
    const mintAuth = meta?.onChainMetadata?.metadata?.updateAuthority || null
    const decimals = sup?.value?.decimals ?? 9
    const totalSupplyRaw = sup?.value?.amount || '0'

    const holderList = (hold?.value || []) as Array<{address:string; amount:string; uiAmount:number}>
    let top1Pct = 0, top5Pct = 0, top10Pct = 0
    const total = BigInt(totalSupplyRaw)
    if (total > 0n && holderList.length) {
      top1Pct  = Number((BigInt(holderList[0]?.amount||'0') * 10000n) / total) / 100
      const s5 = holderList.slice(0,5).reduce((a,h) => a + BigInt(h.amount||'0'), 0n)
      top5Pct  = Number((s5 * 10000n) / total) / 100
      const s10= holderList.slice(0,10).reduce((a,h) => a + BigInt(h.amount||'0'), 0n)
      top10Pct = Number((s10 * 10000n) / total) / 100
    }

    const txTypes = txList.reduce((acc: Record<string,number>, tx: {type?:string}) => {
      const t = tx.type || 'UNKNOWN'; acc[t] = (acc[t]||0) + 1; return acc
    }, {})
    const uniqueSenders = new Set(txList.map((tx: {feePayer?:string}) => tx.feePayer).filter(Boolean)).size

    const price          = dex?.priceUsd        || '0'
    const liquidity      = dex?.liquidity?.usd  || 0
    const volume24h      = dex?.volume?.h24     || 0
    const volume6h       = dex?.volume?.h6      || 0
    const volume1h       = dex?.volume?.h1      || 0
    const priceChange24h = dex?.priceChange?.h24 || 0
    const priceChange6h  = dex?.priceChange?.h6  || 0
    const priceChange1h  = dex?.priceChange?.h1  || 0
    const buys24h        = dex?.txns?.h24?.buys  || 0
    const sells24h       = dex?.txns?.h24?.sells || 0
    const buySellRatio   = sells24h > 0 ? (buys24h / sells24h).toFixed(2) : 'N/A'
    const marketCap      = dex?.marketCap || 0
    const fdv            = dex?.fdv || 0
    const pairAge        = dex?.pairCreatedAt ? Math.floor((Date.now() - dex.pairCreatedAt) / 60000) : null

    let score = 50
    const signals: {label:string; impact:number; severity:string; detail:string}[] = []

    if (!mintAuth) {
      score += 15
      signals.push({ label: 'Mint Authority Revoked', impact: +15, severity: 'positive', detail: 'Supply permanently fixed. No inflation risk.' })
    } else {
      score -= 20
      signals.push({ label: 'Mint Authority Active', impact: -20, severity: 'danger', detail: `${mintAuth.slice(0,8)}... can mint unlimited tokens.` })
    }

    if (top1Pct > 60) {
      score -= 25
      signals.push({ label: `Extreme Concentration: ${top1Pct.toFixed(1)}%`, impact: -25, severity: 'danger', detail: 'Single wallet dominates. Extreme dump risk.' })
    } else if (top1Pct > 30) {
      score -= 12
      signals.push({ label: `High Concentration: ${top1Pct.toFixed(1)}%`, impact: -12, severity: 'warning', detail: 'Top holder controls significant supply.' })
    } else if (top1Pct > 0) {
      score += 10
      signals.push({ label: `Healthy Distribution: ${top1Pct.toFixed(1)}%`, impact: +10, severity: 'positive', detail: 'Supply well distributed.' })
    }

    if (liquidity > 500000)      { score += 15; signals.push({ label: `Strong Liquidity: $${(liquidity/1000).toFixed(0)}K`,   impact: +15, severity: 'positive', detail: 'Deep pool. Low slippage.' }) }
    else if (liquidity > 100000) { score += 8;  signals.push({ label: `Good Liquidity: $${(liquidity/1000).toFixed(0)}K`,     impact: +8,  severity: 'positive', detail: 'Sufficient depth.' }) }
    else if (liquidity > 10000)  { score -= 5;  signals.push({ label: `Low Liquidity: $${(liquidity/1000).toFixed(1)}K`,      impact: -5,  severity: 'warning', detail: 'Limited depth. High slippage.' }) }
    else if (liquidity > 0)      { score -= 20; signals.push({ label: `Critical Liquidity: $${liquidity.toFixed(0)}`,          impact: -20, severity: 'danger',  detail: 'Pool nearly empty.' }) }

    if (volume24h > 1000000) { score += 8; signals.push({ label: `High Volume: $${(volume24h/1e6).toFixed(1)}M`, impact: +8, severity: 'positive', detail: 'Strong trading activity.' }) }
    if (priceChange24h < -70)  { score -= 20; signals.push({ label: `Price Crashed: ${priceChange24h.toFixed(1)}%`, impact: -20, severity: 'danger',  detail: 'Extreme decline. Possible rug.' }) }
    else if (priceChange24h > 300) { score -= 8; signals.push({ label: `Suspicious Pump: +${priceChange24h.toFixed(0)}%`, impact: -8, severity: 'warning', detail: 'Parabolic pump. Often precedes dump.' }) }

    if (buys24h > sells24h * 1.5)  { score += 5; signals.push({ label: `Buy Pressure: ${buySellRatio}x`,  impact: +5, severity: 'positive', detail: 'More buyers. Bullish momentum.' }) }
    else if (sells24h > buys24h * 1.5) { score -= 8; signals.push({ label: `Sell Pressure: ${buySellRatio}x`, impact: -8, severity: 'warning', detail: 'More sellers. Bearish momentum.' }) }

    if (pairAge !== null) {
      if (pairAge < 30)        { score -= 15; signals.push({ label: `Brand New: ${pairAge}min old`,             impact: -15, severity: 'danger',  detail: 'No track record. Extreme risk.' }) }
      else if (pairAge > 43200){ score += 8;  signals.push({ label: `Established: ${Math.floor(pairAge/1440)}d old`, impact: +8, severity: 'positive', detail: '30+ days old. Lower rug risk.' }) }
    }

    if (uniqueSenders > 50) { score += 5; signals.push({ label: `Organic Activity: ${uniqueSenders} wallets`, impact: +5, severity: 'positive', detail: 'Many unique wallets. Real usage.' }) }

    score = Math.max(0, Math.min(100, score))

    const verdict      = score >= 80 ? 'SAFE GEM' : score >= 60 ? 'LOW RISK' : score >= 40 ? 'MODERATE RISK' : score >= 20 ? 'HIGH RISK' : 'DANGER'
    const verdictColor = score >= 80 ? '#22c55e'  : score >= 60 ? '#10b981'  : score >= 40 ? '#f59e0b'       : score >= 20 ? '#ef4444'  : '#dc2626'
    const confidence   = Math.min(95, 70 + signals.length * 2)

    function fmtN(n: number) {
      if (n >= 1e9) return (n/1e9).toFixed(2)+'B'
      if (n >= 1e6) return (n/1e6).toFixed(2)+'M'
      if (n >= 1e3) return (n/1e3).toFixed(1)+'K'
      return n.toFixed(0)
    }

    function fmtSupply(amt: string, dec: number) {
      try {
        const n = Number(BigInt(amt)) / Math.pow(10, dec)
        return fmtN(n)
      } catch { return 'N/A' }
    }

    return NextResponse.json({
      mint, name, symbol, decimals,
      totalSupply: fmtSupply(totalSupplyRaw, decimals),
      mintAuth,
      score, verdict, verdictColor, confidence,
      signals,
      holderIntel: {
        top1Pct, top5Pct, top10Pct,
        totalHolders: holderList.length,
        topHolders: holderList.slice(0,10).map(h => ({
          address: h.address,
          uiAmount: h.uiAmount,
          pct: total > 0n ? Number((BigInt(h.amount||'0') * 10000n) / total) / 100 : 0,
        })),
      },
      marketIntel: {
        price, marketCap: fmtN(marketCap), fdv: fmtN(fdv),
        liquidity: fmtN(liquidity), liquidityRaw: liquidity,
        volume24h: fmtN(volume24h), volume6h: fmtN(volume6h), volume1h: fmtN(volume1h),
        priceChange24h, priceChange6h, priceChange1h,
        buys24h, sells24h, buySellRatio,
        pairAge, dexUrl: dex?.url || '',
      },
      txIntel: {
        total: txList.length, uniqueSenders,
        avgTxPerSender: uniqueSenders > 0 ? (txList.length/uniqueSenders).toFixed(1) : '0',
        types: txTypes,
        recentTxs: txList.slice(0,5).map((tx: {signature?:string; type?:string; timestamp?:number; feePayer?:string}) => ({
          sig: tx.signature ? tx.signature.slice(0,12)+'...' : 'N/A',
          type: tx.type || 'UNKNOWN',
          time: tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleTimeString() : 'N/A',
          feePayer: tx.feePayer ? tx.feePayer.slice(0,8)+'...' : 'N/A',
        })),
      },
      scannedAt: new Date().toISOString(),
      engine: 'CryptoCheck Neural Engine v4',
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Scan failed' }, { status: 500 })
  }
}
