/**
 * Assemble LIVE CONTEXT for an AI Employee from its declared data sources.
 * Server-only — never import from client components.
 */

import { listAlerts } from '@/lib/portfolio-desk/alerts-store'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import {
  fetchNewListings,
  fetchOhlcv,
  fetchTokenList,
  fetchTokenMarket,
  fetchTrending,
} from '@/lib/providers/birdeye'
import { fetchPrices } from '@/lib/providers/jupiter'
import { getAssetsByOwner } from '@/lib/providers/helius'
import { fetchNewPools } from '@/lib/providers/raydium'
import { buildPortfolioAnalytics } from '@/lib/terminal/portfolio-analytics'
import type { AgentDataSource } from '@/types/agents'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const BASE58_MINT_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g

function extractMints(...texts: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of texts) {
    if (!t) continue
    for (const m of t.match(BASE58_MINT_RE) ?? []) {
      if (seen.has(m)) continue
      seen.add(m)
      out.push(m)
      if (out.length >= 5) return out
    }
  }
  return out
}

async function newsSentimentBlock(): Promise<string> {
  const keyed =
    Boolean(process.env.LUNARCRUSH_API_KEY?.trim()) ||
    Boolean(process.env.SANTIMENT_API_KEY?.trim())
  if (!keyed) {
    return [
      'News/sentiment provider: UNCONFIGURED.',
      'Set LUNARCRUSH_API_KEY or SANTIMENT_API_KEY on the server before treating headlines as live.',
      'Do not invent news items.',
    ].join('\n')
  }
  // Provider selected but client not wired yet — honest empty cycle.
  return [
    'News/sentiment provider: key present but client adapter not yet wired.',
    'Report freshness as unavailable; do not invent headlines.',
  ].join('\n')
}

/**
 * Build a plain-text LIVE CONTEXT block for the given sources.
 * ~50–800ms estimated depending on sources + wallet.
 */
export async function buildAgentLiveContext(params: {
  dataSources: AgentDataSource[]
  walletAddress?: string
  mint?: string
  message?: string
}): Promise<string> {
  const { dataSources, walletAddress, mint, message } = params
  const blocks: string[] = []
  const mints = extractMints(mint, message)
  if (mint && !mints.includes(mint)) mints.unshift(mint)

  const want = (s: AgentDataSource) => dataSources.includes(s)

  if (want('jupiter-price')) {
    try {
      const targets = mints.length ? mints : [SOL_MINT]
      // ~40–120ms estimated
      const prices = await fetchPrices(targets)
      if (prices.size === 0) {
        blocks.push('Jupiter prices: unavailable.')
      } else {
        blocks.push(
          'Jupiter prices:',
          ...[...prices.entries()].map(
            ([m, p]) =>
              `- ${m}: usd=${p.priceUsd}${p.change24hPct != null ? ` chg24h=${p.change24hPct}%` : ''}`,
          ),
        )
      }
    } catch {
      blocks.push('Jupiter prices: fetch failed.')
    }
  }

  if (want('birdeye-screener')) {
    try {
      // ~80–200ms estimated
      const trending = await fetchTrending(8)
      const list = trending.length ? trending : await fetchTokenList({ limit: 8 })
      if (!list.length) {
        blocks.push('Screener: unavailable (Birdeye empty or unkeyed).')
      } else {
        blocks.push(
          'Screener rows:',
          ...list.slice(0, 8).map(
            (t, i) =>
              `${i + 1}. ${t.symbol || '?'} (${t.mint}) price=${t.priceUsd} liq=${t.liquidityUsd} vol24h=${t.volume24hUsd} chg24h=${t.change24hPct}%`,
          ),
        )
      }
    } catch {
      blocks.push('Screener: fetch failed.')
    }
  }

  if (want('birdeye-token') || want('birdeye-ohlcv')) {
    const focus = mints[0]
    if (!focus) {
      blocks.push('Token focus: no mint provided — ask user for a mint when needed.')
    } else {
      if (want('birdeye-token')) {
        try {
          // ~50–150ms estimated
          const m = await fetchTokenMarket(focus)
          blocks.push(
            m
              ? `Token market ${m.symbol || '?'} (${focus}): price=${m.priceUsd} liq=${m.liquidityUsd} vol24h=${m.volume24hUsd} mcap=${m.marketCapUsd} holders=${m.holders} chg24h=${m.change24hPct}%`
              : `Token market (${focus}): unavailable.`,
          )
        } catch {
          blocks.push(`Token market (${focus}): fetch failed.`)
        }
      }
      if (want('birdeye-ohlcv')) {
        try {
          const to = Math.floor(Date.now() / 1000)
          const from = to - 24 * 3600
          // ~80–200ms estimated
          const ohlcv = await fetchOhlcv(focus, '1H', from, to)
          if (!ohlcv.length) {
            blocks.push(`OHLCV (${focus}): unavailable.`)
          } else {
            const last = ohlcv[ohlcv.length - 1]
            const first = ohlcv[0]
            blocks.push(
              `OHLCV (${focus}, last ${ohlcv.length} hourly bars): open0=${first.c} closeN=${last.c} highN=${last.h} lowN=${last.l} volN=${last.v}`,
            )
          }
        } catch {
          blocks.push(`OHLCV (${focus}): fetch failed.`)
        }
      }
    }
  }

  if (want('birdeye-new-listings')) {
    try {
      // ~80–200ms estimated
      const listings = await fetchNewListings(10)
      if (!listings.length) {
        blocks.push('New listings: unavailable.')
      } else {
        blocks.push(
          'New listings:',
          ...listings.map(
            (p) =>
              `- ${p.symbol || '?'} (${p.mint}) liq=${p.liquidityUsd} created=${p.createdAt}`,
          ),
        )
      }
    } catch {
      blocks.push('New listings: fetch failed.')
    }
  }

  if (want('raydium-pools')) {
    try {
      // ~80–200ms estimated
      const pools = await fetchNewPools(10)
      if (!pools.length) {
        blocks.push('Raydium new pools: unavailable.')
      } else {
        blocks.push(
          'Raydium new pools:',
          ...pools.map(
            (p) =>
              `- ${p.symbol || '?'} (${p.mint}) liq=${p.liquidityUsd} created=${p.createdAt}`,
          ),
        )
      }
    } catch {
      blocks.push('Raydium new pools: fetch failed.')
    }
  }

  if (want('helius-metadata')) {
    if (walletAddress && walletAddress.length >= 32) {
      try {
        // ~100–300ms estimated
        const assets = await getAssetsByOwner(walletAddress)
        blocks.push(
          `Helius DAS assets for wallet (sample ${Math.min(assets.length, 8)}/${assets.length}):`,
          ...assets.slice(0, 8).map((a) => {
            const id = typeof a.id === 'string' ? a.id : '?'
            const sym = a.content?.metadata?.symbol ?? a.token_info?.symbol ?? '?'
            return `- ${sym} (${id})`
          }),
        )
      } catch {
        blocks.push('Helius metadata: fetch failed.')
      }
    } else if (mints[0]) {
      try {
        // Prefer scan gateway for contract risk — never frozen scanner core.
        const { assessRiskByMint } = await import('@/lib/connect/scan-gateway')
        // ~80–400ms estimated (fast path)
        const risk = await assessRiskByMint(mints[0], 'solana', 'fast')
        blocks.push(
          `Contract risk via scan gateway (${mints[0]}): verdict=${risk.verdict} riskScore=${risk.riskScore} safetyScore=${risk.safetyScore} confidence=${risk.confidence}`,
        )
      } catch {
        blocks.push(`Contract risk (${mints[0]}): assessment unavailable.`)
      }
    } else {
      blocks.push('Helius metadata: need wallet or mint.')
    }
  }

  if (want('helius-webhooks') || want('portfolio-alerts')) {
    try {
      const alerts = await listAlerts(12)
      if (!alerts.length) {
        blocks.push('Portfolio alerts: none recent.')
      } else {
        blocks.push(
          `Portfolio alerts (${alerts.length}):`,
          ...alerts.map((a) => `- [${a.type}] ${a.title}: ${a.description}`),
        )
      }
    } catch {
      blocks.push('Portfolio alerts: fetch failed.')
    }
  }

  if (want('portfolio-analytics')) {
    if (walletAddress && walletAddress.length >= 32) {
      try {
        // ~300–1500ms estimated
        const analytics = await buildPortfolioAnalytics(walletAddress)
        blocks.push(
          `Portfolio analytics wallet=${analytics.walletAddress} totalUsd=${analytics.totalValueUsd}`,
          `concentration=${analytics.concentration} diversification=${analytics.diversification} limitations=${analytics.limitations ?? 'none'}`,
          'Holdings sample:',
          ...analytics.holdings.slice(0, 12).map(
            (h) =>
              `- ${h.symbol} (${h.mint}): valueUsd=${h.valueUsd.toFixed(2)} alloc=${h.allocationPct.toFixed(1)}% risk=${h.riskScore ?? 'n/a'}`,
          ),
        )
      } catch {
        try {
          const holdings = await buildHoldingsResponse(walletAddress)
          blocks.push(
            `Holdings fallback totalUsd=${holdings.totalValueUsd}:`,
            ...holdings.holdings.slice(0, 12).map(
              (h) =>
                `- ${h.symbol}: valueUsd=${h.valueUsd.toFixed(2)} alloc=${h.allocationPct.toFixed(1)}%`,
            ),
          )
        } catch {
          blocks.push('Portfolio analytics: fetch failed.')
        }
      }
    } else {
      blocks.push('Portfolio analytics: no wallet connected.')
    }
  }

  if (want('news-sentiment')) {
    blocks.push(await newsSentimentBlock())
  }

  if (!blocks.length) {
    return 'LIVE CONTEXT: no data sources resolved.'
  }
  return `LIVE CONTEXT:\n${blocks.join('\n')}`
}
