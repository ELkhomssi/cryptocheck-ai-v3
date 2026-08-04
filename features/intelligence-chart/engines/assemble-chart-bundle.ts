/**
 * Server-only assembler — maps real engines → IntelligenceChartBundle.
 * Never invents events; layers without engine data get status: 'no_data'.
 */

import 'server-only'

import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { resolveTokenByQuery } from '@/lib/terminal-os/live-market'
import { getDecisionByTokenId } from '@/lib/terminal-os/decision-store'
import {
  resilientCandles,
  resilientTokens,
  resilientWhales,
} from '@/lib/terminal-os/resilient-feed'
import { buildMarketIntel } from '@/features/terminal-os/ai-trade-like-me/engines/market-intelligence-engine'
import { decide } from '@/features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import type { Decision } from '@cryptocheck/decision-contracts'
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
  // Local decide kept for strip fallback scores only — zones bind to published Decision.
  const localDecision = decide(null, intel)
  const published = await getDecisionByTokenId(token.id)
  const lastCandle = candles[candles.length - 1]
  const lastTime = lastCandle?.time ?? Math.floor(Date.now() / 1000)
  const price = token.priceUsd || lastCandle?.close || 0
  const t0 = candles[0]?.time ?? lastTime - 3600

  const { aiEvents, aiZones, narrativeText, stripConfidence, stripRisk, stripConviction } =
    buildAiOverlays({
      published,
      localDecision,
      intel,
      price,
      lastTime,
      t0,
    })

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

  // ── Layer 5 AI — overlays from published Decision when present (One-Decision) ──
  // (aiEvents / aiZones built above via buildAiOverlays)

  const aiStrip: AiStripPoint[] = candles.length
    ? sampleStrip(candles, stripConfidence, stripConviction, stripRisk, intel, lastTime)
    : [
        {
          time: lastTime,
          confidence: stripConfidence,
          conviction: stripConviction,
          risk: stripRisk,
          trend: clamp(50 + token.change24hPct, 0, 100),
          sourceEngineRef: published
            ? `decision-store:strip:${published.id}`
            : `market-intelligence:strip:${token.id}`,
        },
      ]

  const aiLayer: ChartLayer = {
    id: 'ai',
    sourceEngine: 'decision-engine',
    events: aiEvents,
    status: published ? 'live' : 'no_data',
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
    confidence: stripConfidence,
    risk: stripRisk,
    conviction: stripConviction,
    intel,
    narrative: narrativeText,
    scanSafety,
    holderHealth: null,
    sourceRef: published
      ? `decision-store:${published.id}`
      : `market-intelligence:${token.id}`,
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

function buildAiOverlays(input: {
  published: Decision | null
  localDecision: ReturnType<typeof decide>
  intel: ReturnType<typeof buildMarketIntel>
  price: number
  lastTime: number
  t0: number
}): {
  aiEvents: ChartEvent[]
  aiZones: AiZoneBand[]
  narrativeText: string
  stripConfidence: number
  stripRisk: number
  stripConviction: number
} {
  const { published, localDecision, intel, price, lastTime, t0 } = input

  // Prefer published Decision — One-Decision boundary. No entry zone without BUY.
  if (published) {
    const symbol =
      published.subject.kind === 'token' ? published.subject.symbol : undefined
    const factors = published.contributingFactors
      .slice(0, 3)
      .map((f) => f.summary)
      .filter(Boolean)
    const narrativeText = [
      published.reasoning,
      ...factors,
      published.expectedROI != null ? `Expected ROI ${published.expectedROI.toFixed(1)}%` : null,
    ]
      .filter(Boolean)
      .join(' · ')

    const aiEvents: ChartEvent[] = [
      {
        id: `ai-decision:${published.id}`,
        timestamp: lastTime,
        price,
        severity:
          published.action === 'BUY' || published.action === 'SELL' || published.action === 'EXIT'
            ? 'notable'
            : 'info',
        label: `AI ${published.action}${symbol ? ` $${symbol}` : ''} · confidence ${Math.round(published.confidence)}`,
        detail: narrativeText || 'Published Decision',
        sourceEngineRef: `decision-store:${published.id}`,
        layerId: 'ai',
      },
    ]

    const aiZones: AiZoneBand[] = []
    if (published.action === 'BUY' && price > 0) {
      const roi = published.expectedROI != null ? Math.abs(published.expectedROI) : 4
      aiZones.push({
        id: `zone-entry:${published.id}`,
        kind: 'buy',
        priceLow: price * 0.97,
        priceHigh: price * (1 + Math.min(0.08, roi / 100)),
        timeFrom: t0,
        timeTo: lastTime,
        confidence: published.confidence,
        sourceEngineRef: `decision-store:zone:entry:${published.id}`,
        label: 'AI Entry Zone',
      })
    }
    if ((published.action === 'SELL' || published.action === 'EXIT') && price > 0) {
      const dd =
        published.expectedDrawdown != null ? Math.abs(published.expectedDrawdown) : 4
      aiZones.push({
        id: `zone-exit:${published.id}`,
        kind: 'sell',
        priceLow: price * (1 - Math.min(0.08, dd / 100)),
        priceHigh: price * 1.02,
        timeFrom: t0,
        timeTo: lastTime,
        confidence: published.confidence,
        sourceEngineRef: `decision-store:zone:exit:${published.id}`,
        label: 'AI Exit Zone',
      })
    }
    // Stop Loss / Take Profit / Whale shaded bands: omitted — not on Decision contract.

    return {
      aiEvents,
      aiZones,
      narrativeText: narrativeText || published.reasoning,
      stripConfidence: published.confidence,
      stripRisk: published.risk,
      stripConviction: published.personalizedConfidence ?? published.marketConfidence,
    }
  }

  // No published Decision — honest empty zones (do not invent BUY from local ROI).
  const explained = explainDecision(localDecision)
  const narrativeText =
    'No Decision published yet — chart zones omitted until Decision Engine publishes for this token.'
  return {
    aiEvents: [
      {
        id: `ai-decision:none:${lastTime}`,
        timestamp: lastTime,
        price,
        severity: 'info',
        label: 'No Decision published yet',
        detail: [explained.headline, explained.confidenceLine].filter(Boolean).join(' · '),
        sourceEngineRef: `decision-store:empty:${intel.tokenAddress}`,
        layerId: 'ai',
      },
    ],
    aiZones: [],
    narrativeText,
    stripConfidence: localDecision.opportunity.confidence,
    stripRisk: localDecision.opportunity.risk,
    stripConviction: localDecision.opportunity.probability,
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
  confidence: number,
  conviction: number,
  risk: number,
  intel: ReturnType<typeof buildMarketIntel>,
  lastTime: number,
): AiStripPoint[] {
  const step = Math.max(1, Math.floor(candles.length / 12))
  const out: AiStripPoint[] = []
  for (let i = 0; i < candles.length; i += step) {
    const c = candles[i]!
    out.push({
      time: c.time,
      confidence,
      conviction,
      risk,
      trend: clamp(50 + (intel.predictionUpsidePct ?? 0), 0, 100),
      sourceEngineRef: `decision-engine:strip:${Math.round(confidence)}:${c.time}`,
    })
  }
  if (!out.length || out[out.length - 1]!.time !== lastTime) {
    out.push({
      time: lastTime,
      confidence,
      conviction,
      risk,
      trend: clamp(50 + (intel.predictionUpsidePct ?? 0), 0, 100),
      sourceEngineRef: `decision-engine:strip:${Math.round(confidence)}:${lastTime}`,
    })
  }
  return out
}

function buildSidebarTimeline(input: {
  candles: { time: number }[]
  confidence: number
  risk: number
  conviction: number
  intel: ReturnType<typeof buildMarketIntel>
  narrative: string
  scanSafety: number | null
  holderHealth: number | null
  sourceRef: string
}): IntelligenceSidebarState[] {
  const {
    confidence,
    risk,
    conviction,
    intel,
    narrative,
    scanSafety,
    holderHealth,
    candles,
    sourceRef,
  } = input
  if (!candles.length) {
    return [
      {
        timestamp: Math.floor(Date.now() / 1000),
        aiConviction: conviction,
        risk,
        confidence,
        narrative,
        trend: clamp(50 + (intel.predictionUpsidePct ?? 0), 0, 100),
        smartMoneyActivity: intel.smartMoneyScore,
        whalePressure: intel.whaleBias,
        holderHealth,
        sourceRefs: [
          sourceRef,
          `market-intelligence:${intel.tokenAddress}`,
          ...(scanSafety != null ? [`scan-gateway:safety:${scanSafety}`] : []),
        ],
      },
    ]
  }
  const idxs = [0, Math.floor(candles.length / 2), candles.length - 1]
  return idxs.map((i) => {
    const t = candles[i]!.time
    return {
      timestamp: t,
      aiConviction: conviction,
      risk,
      confidence,
      narrative,
      trend: clamp(50 + (intel.predictionUpsidePct ?? 0), 0, 100),
      smartMoneyActivity: intel.smartMoneyScore,
      whalePressure: intel.whaleBias,
      holderHealth,
      sourceRefs: [
        `${sourceRef}:${t}`,
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
