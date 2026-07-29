/**
 * Server-only assembler — maps real engines → IntelligenceChartBundle.
 * Never invents events; layers without engine data get status: 'no_data'.
 */

import 'server-only'

import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { resolveTokenByQuery } from '@/lib/terminal-os/live-market'
import {
  resilientCandles,
  resilientTokens,
  resilientWhales,
} from '@/lib/terminal-os/resilient-feed'
import { buildMarketIntel } from '@/features/terminal-os/ai-trade-like-me/engines/market-intelligence-engine'
import { decide } from '@/features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import type { ChainId, TokenRow, WhaleMovement } from '@/features/terminal-os/shared/types'
import type {
  AiStripPoint,
  AiZoneBand,
  ChartEvent,
  ChartLayer,
  HolderSeriesPoint,
  IntelligenceChartBundle,
  IntelligenceSidebarState,
  LiquidityRibbonPoint,
} from '../types'
import { DEFAULT_LAYER_VISIBILITY } from '../types'

function emptyLayer(
  id: ChartLayer['id'],
  sourceEngine: ChartLayer['sourceEngine'],
  visible: boolean,
): ChartLayer {
  return { id, sourceEngine, events: [], status: 'no_data', visible }
}

export async function assembleIntelligenceChart(input: {
  query: string
  chain?: ChainId
}): Promise<IntelligenceChartBundle | null> {
  const chain = input.chain || 'all'
  const query = input.query.trim()
  if (!query) return null

  const tokensEnv = await resilientTokens(chain === 'all' ? 'all' : chain, 16)
  const needle = query.toLowerCase()
  let token: TokenRow | null =
    tokensEnv.data.find(
      (t) =>
        t.symbol.toLowerCase() === needle ||
        t.id.toLowerCase() === needle ||
        (t.pairAddress && t.pairAddress.toLowerCase() === needle),
    ) ?? null

  if (!token) {
    try {
      token = await resolveTokenByQuery(query, chain)
    } catch {
      token = null
    }
  }
  if (!token) return null

  const [candlesEnv, whalesEnv] = await Promise.all([
    resilientCandles(token.chain === 'all' ? 'solana' : token.chain),
    resilientWhales(48),
  ])

  const candles = candlesEnv.data
  const relatedWhales = whalesEnv.data.filter(
    (w) => w.assetSymbol.toUpperCase() === token!.symbol.toUpperCase(),
  )

  // ── Security / token scanner (gateway) ──
  let scanSafety: number | null = null
  let scanRisk: number | null = null
  let scanVerdict: string | null = null
  let scanRef: string | null = null
  let securityBand: 'excellent' | 'good' | 'caution' | 'danger' = 'good'

  if (token.chain === 'solana' || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token.id)) {
    try {
      const assess = await assessRiskByMint(token.id, 'solana', 'fast')
      scanSafety = assess.safetyScore
      scanRisk = assess.riskScore
      scanVerdict = assess.verdict
      scanRef = `scan-gateway:${token.id}:${assess.verdict}`
      securityBand =
        assess.safetyScore >= 80
          ? 'excellent'
          : assess.safetyScore >= 65
            ? 'good'
            : assess.safetyScore >= 45
              ? 'caution'
              : 'danger'
    } catch {
      // leave null — security layer becomes no_data
    }
  }

  const intel = buildMarketIntel({
    token,
    whales: relatedWhales,
    tokenScore: scanSafety ?? undefined,
    riskScore: scanRisk ?? undefined,
    securityBand,
  })
  const decision = decide(null, intel)
  const explained = explainDecision(decision)
  const narrativeText = [explained.headline, explained.confidenceLine, ...explained.bullets.slice(0, 3)]
    .filter(Boolean)
    .join(' · ')

  const lastCandle = candles[candles.length - 1]
  const lastTime = lastCandle?.time ?? Math.floor(Date.now() / 1000)
  const price = token.priceUsd || lastCandle?.close || 0

  // ── Layer 2 Liquidity (Market Intelligence + whale flow) ──
  const liquidityEvents: ChartEvent[] = relatedWhales
    .filter((w) => w.classification === 'Liquidity Migration' || w.usdValue >= 50_000)
    .slice(0, 24)
    .map((w) => whaleToLiquidityEvent(w, price))

  if (token.liquidityUsd > 0 && lastCandle) {
    liquidityEvents.push({
      id: `liq-snap:${token.id}:${lastTime}`,
      timestamp: lastTime,
      price,
      severity: token.liquidityUsd < 50_000 ? 'notable' : 'info',
      label: `Liquidity ${formatUsd(token.liquidityUsd)} · trend ${intel.liquidityTrend}`,
      detail: `Market Intelligence Engine — live pool depth $${Math.round(token.liquidityUsd).toLocaleString()} (${intel.liquidityTrend}).`,
      sourceEngineRef: `market-intelligence:liquidity:${token.id}:${tokensEnv.fetchedAt}`,
      layerId: 'liquidity',
      magnitudeUsd: token.liquidityUsd,
    })
  }

  // No historical liquidity series from engines yet — do not fabricate a ribbon curve.
  // When a time-series feed lands, populate LiquidityRibbonPoint[] here.
  const liquidityRibbon: LiquidityRibbonPoint[] =
    token.liquidityUsd > 0 && lastCandle
      ? [
          {
            time: lastTime,
            liquidityUsd: token.liquidityUsd,
            sourceEngineRef: `market-intelligence:liq-spot:${token.id}:${lastTime}`,
          },
        ]
      : []

  const liquidityLayer: ChartLayer = {
    id: 'liquidity',
    sourceEngine: 'market-intelligence',
    events: liquidityEvents,
    status: liquidityEvents.length ? 'live' : 'no_data',
    visible: DEFAULT_LAYER_VISIBILITY.liquidity,
  }

  // ── Layer 3 Holders — no historical holder feed wired → no_data ──
  const holderSeries: HolderSeriesPoint[] = []
  const holdersLayer = emptyLayer('holders', 'wallet-intelligence', DEFAULT_LAYER_VISIBILITY.holders)

  // ── Layer 4 Developer — no contract-event stream wired → no_data ──
  const developerLayer = emptyLayer(
    'developer',
    'security-scanner',
    DEFAULT_LAYER_VISIBILITY.developer,
  )

  // ── Layer 5 AI (Decision + Explainable engines) ──
  const aiEvents: ChartEvent[] = [
    {
      id: `ai-decision:${decision.opportunity.confidence}:${lastTime}`,
      timestamp: lastTime,
      price,
      severity: decision.action === 'BUY' || decision.action === 'SELL' ? 'notable' : 'info',
      label: `AI ${decision.action} · confidence ${decision.opportunity.confidence}`,
      detail: narrativeText,
      sourceEngineRef: `decision-engine:${decision.opportunity.confidence}:${decision.action}`,
      layerId: 'ai',
    },
  ]

  const aiZones: AiZoneBand[] = []
  const t0 = candles[0]?.time ?? lastTime - 3600
  if (decision.action === 'BUY' || decision.opportunity.expectedRoiPct > 2) {
    aiZones.push({
      id: `zone-buy:${lastTime}`,
      kind: 'buy',
      priceLow: price * 0.97,
      priceHigh: price * (1 + Math.min(0.08, Math.abs(decision.opportunity.expectedRoiPct) / 100)),
      timeFrom: t0,
      timeTo: lastTime,
      confidence: decision.opportunity.confidence,
      sourceEngineRef: `decision-engine:zone:buy:${decision.opportunity.confidence}`,
      label: 'AI Buy Zone',
    })
  }
  if (decision.action === 'SELL' || decision.action === 'EXIT' || intel.whaleBias === 'distributing') {
    aiZones.push({
      id: `zone-sell:${lastTime}`,
      kind: 'sell',
      priceLow: price * (1 - Math.min(0.08, Math.abs(decision.opportunity.expectedDrawdownPct) / 100)),
      priceHigh: price * 1.02,
      timeFrom: t0,
      timeTo: lastTime,
      confidence: decision.opportunity.confidence,
      sourceEngineRef: `decision-engine:zone:sell:${decision.opportunity.confidence}`,
      label: 'AI Sell Zone',
    })
  }

  const aiStrip: AiStripPoint[] = candles.length
    ? sampleStrip(candles, decision, intel, lastTime)
    : [
        {
          time: lastTime,
          confidence: decision.opportunity.confidence,
          conviction: decision.opportunity.probability,
          risk: decision.opportunity.risk,
          trend: clamp(50 + token.change24hPct, 0, 100),
          sourceEngineRef: `decision-engine:strip:${decision.opportunity.confidence}`,
        },
      ]

  const aiLayer: ChartLayer = {
    id: 'ai',
    sourceEngine: 'decision-engine',
    events: aiEvents,
    status: 'live',
    visible: DEFAULT_LAYER_VISIBILITY.ai,
  }

  // ── Layer 6 Security ──
  const securityEvents: ChartEvent[] = []
  if (scanRef && scanVerdict) {
    const critical =
      scanVerdict === 'BLOCKED' ||
      scanVerdict === 'HIGH_RISK' ||
      securityBand === 'danger'
    securityEvents.push({
      id: `sec:${scanRef}`,
      timestamp: lastTime,
      price,
      severity: critical ? 'critical' : securityBand === 'caution' ? 'notable' : 'info',
      label: `Security ${scanVerdict} · safety ${scanSafety}`,
      detail: `Scan gateway (fast) — verdict ${scanVerdict}, safety ${scanSafety}, risk ${scanRisk}.`,
      sourceEngineRef: scanRef,
      layerId: 'security',
    })
  }
  const securityLayer: ChartLayer = {
    id: 'security',
    sourceEngine: 'security-scanner',
    events: securityEvents,
    status: securityEvents.length ? 'live' : 'no_data',
    visible: DEFAULT_LAYER_VISIBILITY.security,
  }

  // ── Layer 7 Narrative (aggregation of other layers' labels) ──
  const narrativeEvents: ChartEvent[] = [
    ...liquidityEvents,
    ...aiEvents,
    ...securityEvents,
  ].map((e) => ({
    ...e,
    id: `narr:${e.id}`,
    layerId: 'narrative' as const,
    sourceEngineRef: `aggregation:${e.sourceEngineRef}`,
  }))
  const narrativeLayer: ChartLayer = {
    id: 'narrative',
    sourceEngine: 'aggregation',
    events: narrativeEvents,
    status: narrativeEvents.length ? 'live' : 'no_data',
    visible: DEFAULT_LAYER_VISIBILITY.narrative,
  }

  const layers: ChartLayer[] = [
    { id: 'price', sourceEngine: 'market-intelligence', events: [], status: 'live', visible: true },
    liquidityLayer,
    holdersLayer,
    developerLayer,
    aiLayer,
    securityLayer,
    narrativeLayer,
  ]

  const sidebarTimeline = buildSidebarTimeline({
    candles,
    decision,
    intel,
    narrative: narrativeText,
    scanSafety,
    holderHealth: null,
  })

  return {
    token: {
      id: token.id,
      symbol: token.symbol,
      name: token.name,
      chain: token.chain,
      priceUsd: token.priceUsd,
      change24hPct: token.change24hPct,
      liquidityUsd: token.liquidityUsd,
      volume24hUsd: token.volume24hUsd,
      logoUrl: token.logoUrl,
    },
    candles,
    layers,
    aiZones,
    aiStrip,
    liquidityRibbon,
    holderSeries,
    sidebarTimeline,
    fetchedAt: new Date().toISOString(),
    stale: candlesEnv.stale || tokensEnv.stale,
    demo: candlesEnv.demo || tokensEnv.demo,
    source: `intelligence-chart+${candlesEnv.source}`,
  }
}

function whaleToLiquidityEvent(w: WhaleMovement, fallbackPrice: number): ChartEvent {
  const ts = Math.floor(new Date(w.occurredAt).getTime() / 1000)
  const severity =
    w.classification === 'Possible Rug' || w.classification === 'Exit Signal'
      ? 'critical'
      : w.usdValue >= 250_000
        ? 'notable'
        : 'info'
  return {
    id: `liq-whale:${w.id}`,
    timestamp: ts,
    price: fallbackPrice,
    severity,
    label: `${w.action.toUpperCase()} ${formatUsd(w.usdValue)} · ${w.classification}`,
    detail: w.classificationWhy || w.aiReasoning,
    sourceEngineRef: `market-intelligence:whale:${w.id}`,
    layerId: 'liquidity',
    magnitudeUsd: w.usdValue,
  }
}

function sampleStrip(
  candles: { time: number }[],
  decision: ReturnType<typeof decide>,
  intel: ReturnType<typeof buildMarketIntel>,
  lastTime: number,
): AiStripPoint[] {
  // Sparse real samples: only emit points at candle times with the same live engine scores
  // (no fabricated historical AI series — strip is flat until we have time-series decisions)
  const step = Math.max(1, Math.floor(candles.length / 12))
  const out: AiStripPoint[] = []
  for (let i = 0; i < candles.length; i += step) {
    const c = candles[i]!
    out.push({
      time: c.time,
      confidence: decision.opportunity.confidence,
      conviction: decision.opportunity.probability,
      risk: decision.opportunity.risk,
      trend: clamp(50 + (intel.predictionUpsidePct ?? 0), 0, 100),
      sourceEngineRef: `decision-engine:strip:${decision.opportunity.confidence}:${c.time}`,
    })
  }
  if (!out.length || out[out.length - 1]!.time !== lastTime) {
    out.push({
      time: lastTime,
      confidence: decision.opportunity.confidence,
      conviction: decision.opportunity.probability,
      risk: decision.opportunity.risk,
      trend: clamp(50 + (intel.predictionUpsidePct ?? 0), 0, 100),
      sourceEngineRef: `decision-engine:strip:${decision.opportunity.confidence}:${lastTime}`,
    })
  }
  return out
}

function buildSidebarTimeline(input: {
  candles: { time: number }[]
  decision: ReturnType<typeof decide>
  intel: ReturnType<typeof buildMarketIntel>
  narrative: string
  scanSafety: number | null
  holderHealth: number | null
}): IntelligenceSidebarState[] {
  const { decision, intel, narrative, scanSafety, holderHealth, candles } = input
  if (!candles.length) {
    return [
      {
        timestamp: Math.floor(Date.now() / 1000),
        aiConviction: decision.opportunity.probability,
        risk: decision.opportunity.risk,
        confidence: decision.opportunity.confidence,
        narrative,
        trend: clamp(50 + (intel.predictionUpsidePct ?? 0), 0, 100),
        smartMoneyActivity: intel.smartMoneyScore,
        whalePressure: intel.whaleBias,
        holderHealth,
        sourceRefs: [
          `decision-engine:${decision.opportunity.confidence}`,
          `market-intelligence:${intel.tokenAddress}`,
          ...(scanSafety != null ? [`scan-gateway:safety:${scanSafety}`] : []),
        ],
      },
    ]
  }
  // Sparse timeline: first, mid, last — getStateAtTimestamp picks latest ≤ ts
  const idxs = [0, Math.floor(candles.length / 2), candles.length - 1]
  return idxs.map((i) => {
    const t = candles[i]!.time
    return {
      timestamp: t,
      aiConviction: decision.opportunity.probability,
      risk: decision.opportunity.risk,
      confidence: decision.opportunity.confidence,
      narrative,
      trend: clamp(50 + (intel.predictionUpsidePct ?? 0), 0, 100),
      smartMoneyActivity: intel.smartMoneyScore,
      whalePressure: intel.whaleBias,
      holderHealth,
      sourceRefs: [
        `decision-engine:${decision.opportunity.confidence}:${t}`,
        `market-intelligence:${intel.tokenAddress}:${t}`,
      ],
    }
  })
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}
