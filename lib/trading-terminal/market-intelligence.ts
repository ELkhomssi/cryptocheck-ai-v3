/**
 * Market Intelligence contracts — status bar, pulse cards, feed, heatmap.
 * Live feeds where wired; demo/sample otherwise — never fabricate live.
 */

import { getTerminalSnapshot } from './data/adapters'
import type { IntelEvent, TerminalDataMode } from './data/types'
import { resolveIntelligence } from './engines/resolve-intelligence'

export type MarketIntelSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export type MarketStatusMetric = {
  id: string
  label: string
  /** Numeric value for animated counters when possible */
  valueNum: number | null
  /** Formatted fallback / suffix display */
  display: string
  prefix?: string
  suffix?: string
  decimals?: number
  changePct: number | null
  sample: boolean
}

export type MarketPulseCard = {
  id: string
  label: string
  valueNum: number
  display: string
  deltaLabel: string | null
  tone: 'pos' | 'neg' | 'warn' | 'neutral' | 'info'
  sample: boolean
}

export type MarketFeedEvent = {
  id: string
  at: string
  token: string
  mint: string | null
  severity: MarketIntelSeverity
  description: string
  sample: boolean
}

export type HeatmapRisk = 'safe' | 'medium' | 'high'

export type HeatmapCell = {
  id: string
  mint: string
  symbol: string
  name: string
  risk: HeatmapRisk
  riskScore: number
  liquidityUsd: number | null
  holders: number | null
  volumeUsd: number | null
  changePct: number
  weight: number
  sample: boolean
}

export type MarketIntelligenceBundle = {
  mode: TerminalDataMode
  status: MarketStatusMetric[]
  pulse: MarketPulseCard[]
  feed: MarketFeedEvent[]
  heatmap: HeatmapCell[]
  methodNote: string
  sample: boolean
}

export type LiveMarketQuotes = {
  solUsd: number | null
  solChangePct: number | null
  btcUsd: number | null
  btcChangePct: number | null
  ethUsd: number | null
  ethChangePct: number | null
  fearGreed: number | null
  fearGreedLabel: string | null
  marketCapUsd: number | null
  marketCapChangePct: number | null
  tps: number | null
  activeWallets: number | null
  source: string
}

function severityFromIntel(kind: IntelEvent['kind']): MarketIntelSeverity {
  if (kind === 'risk_score_change' || kind === 'smart_money_sell') return 'CRITICAL'
  if (kind === 'whale_accumulation' || kind === 'large_sell') return 'WARNING'
  return 'INFO'
}

function badgeToRisk(badge: string | null, changePct: number): {
  risk: HeatmapRisk
  riskScore: number
} {
  if (badge === 'RISK') return { risk: 'high', riskScore: 78 }
  if (badge === 'SAFE') return { risk: 'safe', riskScore: 22 }
  if (badge === 'HOT' || badge === 'TRENDING') {
    return changePct < -12
      ? { risk: 'medium', riskScore: 55 }
      : { risk: 'safe', riskScore: 34 }
  }
  if (changePct <= -20) return { risk: 'high', riskScore: 72 }
  if (changePct >= 15) return { risk: 'medium', riskScore: 48 }
  return { risk: 'medium', riskScore: 45 }
}

function fmtUsdCompact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

/** Demo-derived pulse + feed + heatmap (labeled sample). */
function buildDemoBundle(live: LiveMarketQuotes | null): MarketIntelligenceBundle {
  const snap = getTerminalSnapshot('demo')
  const seedIntel = snap.intel.status === 'ready' ? snap.intel.data : []
  const discover = snap.discover.status === 'ready' ? snap.discover.data : []
  const coach = snap.coach.status === 'ready' ? snap.coach.data : null
  const intel = resolveIntelligence({ mode: 'demo', focusMint: snap.focus?.mint })

  const newTokens = Math.max(
    1,
    discover.filter((d) => d.badge === 'NEW').length +
      seedIntel.filter((e) => e.kind === 'new_pool').length,
  )
  const highRisk = Math.max(
    1,
    discover.filter((d) => d.badge === 'RISK').length +
      (coach?.threats.filter((t) => t.severity === 'HIGH').length ?? 0),
  )
  const whaleTx = Math.max(
    1,
    seedIntel.filter(
      (e) =>
        e.kind === 'whale_accumulation' || e.kind === 'large_buy' || e.kind === 'large_sell',
    ).length * 4,
  )
  const liqAddedUsd = intel.opportunities
    .filter((o) => o.measuredInputs.liquidityExpansionPct > 0)
    .reduce((a, o) => a + Math.max(0, o.measuredInputs.smartMoneyNetInflowUsd), 0)
  const liqRemovedUsd = Math.abs(
    intel.opportunities
      .filter((o) => o.measuredInputs.liquidityExpansionPct < 0)
      .reduce((a, o) => a + Math.min(0, o.measuredInputs.smartMoneyNetInflowUsd), 0),
  )
  const rugAlerts = Math.max(
    1,
    (coach?.threats.filter((t) => t.severity === 'HIGH').length ?? 0) +
      seedIntel.filter((e) => e.kind === 'risk_score_change').length,
  )

  const pulse: MarketPulseCard[] = [
    {
      id: 'new_tokens',
      label: 'New Tokens Today',
      valueNum: newTokens,
      display: String(newTokens),
      deltaLabel: 'Demo universe',
      tone: 'info',
      sample: true,
    },
    {
      id: 'high_risk',
      label: 'High Risk Tokens',
      valueNum: highRisk,
      display: String(highRisk),
      deltaLabel: 'Scan-gated',
      tone: 'warn',
      sample: true,
    },
    {
      id: 'whale_tx',
      label: 'Whale Transactions',
      valueNum: whaleTx,
      display: String(whaleTx),
      deltaLabel: '1h window',
      tone: 'pos',
      sample: true,
    },
    {
      id: 'liq_added',
      label: 'Liquidity Added',
      valueNum: liqAddedUsd || 1,
      display: fmtUsdCompact(liqAddedUsd || 182_000),
      deltaLabel: 'SM inflow proxy',
      tone: 'pos',
      sample: true,
    },
    {
      id: 'liq_removed',
      label: 'Liquidity Removed',
      valueNum: liqRemovedUsd || 1,
      display: fmtUsdCompact(liqRemovedUsd || 41_000),
      deltaLabel: 'SM outflow proxy',
      tone: 'neg',
      sample: true,
    },
    {
      id: 'rug_alerts',
      label: 'Rug Alerts Today',
      valueNum: rugAlerts,
      display: String(rugAlerts),
      deltaLabel: 'Critical path',
      tone: 'neg',
      sample: true,
    },
  ]

  const feed: MarketFeedEvent[] = seedIntel.map((e) => ({
    id: e.id,
    at: e.at,
    token: e.symbol,
    mint: e.mint,
    severity: severityFromIntel(e.kind),
    description: `${e.headline} — ${e.detail}`,
    sample: true,
  }))

  // Enrich feed with opportunity / threat lines
  for (const t of coach?.threats ?? []) {
    feed.push({
      id: `threat:${t.symbol}`,
      at: new Date().toISOString(),
      token: t.symbol,
      mint: null,
      severity: t.severity === 'HIGH' ? 'CRITICAL' : 'WARNING',
      description: t.reason,
      sample: true,
    })
  }

  feed.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  const heatmap: HeatmapCell[] = discover.map((d) => {
    const { risk, riskScore } = badgeToRisk(d.badge, d.changePct)
    const liq = d.marketCapUsd > 0 ? d.marketCapUsd * 0.08 : null
    return {
      id: d.mint,
      mint: d.mint,
      symbol: d.symbol,
      name: d.name,
      risk,
      riskScore,
      liquidityUsd: liq,
      holders: d.views > 0 ? Math.round(d.views * 12.5) : null,
      volumeUsd: d.marketCapUsd > 0 ? d.marketCapUsd * 0.15 : null,
      changePct: d.changePct,
      weight: Math.max(1, Math.log10(Math.max(d.marketCapUsd, 10_000))),
      sample: true,
    }
  })

  const sol = live?.solUsd ?? snap.solPriceUsd ?? 148.62
  const status: MarketStatusMetric[] = [
    {
      id: 'sol',
      label: 'SOL',
      valueNum: sol,
      display: sol.toFixed(2),
      prefix: '$',
      decimals: 2,
      changePct: live?.solChangePct ?? 2.4,
      sample: live?.solUsd == null,
    },
    {
      id: 'btc',
      label: 'BTC',
      valueNum: live?.btcUsd ?? 97_420,
      display: (live?.btcUsd ?? 97_420).toLocaleString(),
      prefix: '$',
      decimals: 0,
      changePct: live?.btcChangePct ?? 1.1,
      sample: live?.btcUsd == null,
    },
    {
      id: 'eth',
      label: 'ETH',
      valueNum: live?.ethUsd ?? 3_540,
      display: (live?.ethUsd ?? 3_540).toLocaleString(),
      prefix: '$',
      decimals: 0,
      changePct: live?.ethChangePct ?? -0.6,
      sample: live?.ethUsd == null,
    },
    {
      id: 'fng',
      label: 'Fear & Greed',
      valueNum: live?.fearGreed ?? (snap.fearGreed.status === 'ready' ? snap.fearGreed.data.score : 72),
      display: String(
        live?.fearGreed ?? (snap.fearGreed.status === 'ready' ? snap.fearGreed.data.score : 72),
      ),
      suffix: ` ${live?.fearGreedLabel ?? (snap.fearGreed.status === 'ready' ? snap.fearGreed.data.label : 'Greed')}`,
      decimals: 0,
      changePct: null,
      sample: live?.fearGreed == null,
    },
    {
      id: 'tps',
      label: 'Solana TPS',
      valueNum: live?.tps ?? 1352,
      display: String(live?.tps ?? 1352),
      decimals: 0,
      changePct: null,
      sample: live?.tps == null,
    },
    {
      id: 'wallets',
      label: 'Active Wallets',
      valueNum: live?.activeWallets ?? 1.84e6,
      display: live?.activeWallets != null ? fmtUsdCompact(live.activeWallets).replace('$', '') : '1.84M',
      decimals: 0,
      changePct: 0.8,
      sample: live?.activeWallets == null,
    },
    {
      id: 'mcap',
      label: 'Total Market Cap',
      valueNum: live?.marketCapUsd ?? 2.41e12,
      display: live?.marketCapUsd != null ? fmtUsdCompact(live.marketCapUsd) : '$2.41T',
      decimals: 0,
      changePct: live?.marketCapChangePct ?? 1.2,
      sample: live?.marketCapUsd == null,
    },
  ]

  return {
    mode: 'demo',
    status,
    pulse,
    feed,
    heatmap,
    methodNote: 'market-intelligence-v1 · demo desk',
    sample: true,
  }
}

function buildLiveBundle(live: LiveMarketQuotes | null): MarketIntelligenceBundle {
  const status: MarketStatusMetric[] = [
    {
      id: 'sol',
      label: 'SOL',
      valueNum: live?.solUsd ?? null,
      display: live?.solUsd != null ? live.solUsd.toFixed(2) : '—',
      prefix: '$',
      decimals: 2,
      changePct: live?.solChangePct ?? null,
      sample: false,
    },
    {
      id: 'btc',
      label: 'BTC',
      valueNum: live?.btcUsd ?? null,
      display: live?.btcUsd != null ? live.btcUsd.toLocaleString() : '—',
      prefix: '$',
      decimals: 0,
      changePct: live?.btcChangePct ?? null,
      sample: false,
    },
    {
      id: 'eth',
      label: 'ETH',
      valueNum: live?.ethUsd ?? null,
      display: live?.ethUsd != null ? live.ethUsd.toLocaleString() : '—',
      prefix: '$',
      decimals: 0,
      changePct: live?.ethChangePct ?? null,
      sample: false,
    },
    {
      id: 'fng',
      label: 'Fear & Greed',
      valueNum: live?.fearGreed ?? null,
      display: live?.fearGreed != null ? String(live.fearGreed) : '—',
      suffix: live?.fearGreedLabel ? ` ${live.fearGreedLabel}` : '',
      decimals: 0,
      changePct: null,
      sample: false,
    },
    {
      id: 'tps',
      label: 'Solana TPS',
      valueNum: live?.tps ?? null,
      display: live?.tps != null ? String(Math.round(live.tps)) : '—',
      decimals: 0,
      changePct: null,
      sample: false,
    },
    {
      id: 'wallets',
      label: 'Active Wallets',
      valueNum: live?.activeWallets ?? null,
      display: live?.activeWallets != null ? fmtUsdCompact(live.activeWallets).replace('$', '') : '—',
      decimals: 0,
      changePct: null,
      sample: false,
    },
    {
      id: 'mcap',
      label: 'Total Market Cap',
      valueNum: live?.marketCapUsd ?? null,
      display: live?.marketCapUsd != null ? fmtUsdCompact(live.marketCapUsd) : '—',
      decimals: 0,
      changePct: live?.marketCapChangePct ?? null,
      sample: false,
    },
  ]

  const pulse: MarketPulseCard[] = [
    {
      id: 'new_tokens',
      label: 'New Tokens Today',
      valueNum: 0,
      display: '—',
      deltaLabel: 'awaiting feed',
      tone: 'neutral',
      sample: false,
    },
    {
      id: 'high_risk',
      label: 'High Risk Tokens',
      valueNum: 0,
      display: '—',
      deltaLabel: 'awaiting feed',
      tone: 'neutral',
      sample: false,
    },
    {
      id: 'whale_tx',
      label: 'Whale Transactions',
      valueNum: 0,
      display: '—',
      deltaLabel: 'awaiting feed',
      tone: 'neutral',
      sample: false,
    },
    {
      id: 'liq_added',
      label: 'Liquidity Added',
      valueNum: 0,
      display: '—',
      deltaLabel: 'awaiting feed',
      tone: 'neutral',
      sample: false,
    },
    {
      id: 'liq_removed',
      label: 'Liquidity Removed',
      valueNum: 0,
      display: '—',
      deltaLabel: 'awaiting feed',
      tone: 'neutral',
      sample: false,
    },
    {
      id: 'rug_alerts',
      label: 'Rug Alerts Today',
      valueNum: 0,
      display: '—',
      deltaLabel: 'awaiting feed',
      tone: 'neutral',
      sample: false,
    },
  ]

  return {
    mode: 'live',
    status,
    pulse,
    feed: [],
    heatmap: [],
    methodNote: `market-intelligence-v1 · ${live?.source ?? 'live awaiting'}`,
    sample: false,
  }
}

export function buildMarketIntelligence(
  mode: TerminalDataMode,
  live: LiveMarketQuotes | null = null,
): MarketIntelligenceBundle {
  if (mode === 'demo') return buildDemoBundle(live)
  return buildLiveBundle(live)
}

export function formatFeedTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const d = new Date(t)
  return d.toISOString().slice(11, 19)
}
