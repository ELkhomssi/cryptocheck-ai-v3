/**
 * Server-only assembler — maps real engines → IntelligenceChartBundle.
 * Never invents events; layers without engine data get status: 'no_data'.
 * AI strip prefers server Decision store over local decide(null).
 */

import 'server-only'

import { assessRiskByMint } from '@/lib/connect/scan-gateway'
import { resolveTokenByQuery } from '@/lib/terminal-os/live-market'
import {
  resilientCandles,
  resilientTokens,
  resilientWhales,
} from '@/lib/terminal-os/resilient-feed'
import {
  getDecisionByTokenId,
  getDecisionHistory,
  saveDecision,
  type DecisionHistoryPoint,
} from '@/lib/terminal-os/decision-store'
import { buildMarketIntel } from '@/features/terminal-os/ai-trade-like-me/engines/market-intelligence-engine'
import { decide } from '@/features/terminal-os/ai-trade-like-me/engines/decision-engine'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import { toCanonicalDecision } from '@/features/terminal-os/ai-trade-like-me/lib/to-canonical-decision'
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

/** Narrow AI view shared by store Decision + local decide() */
type ChartAiDecision = {
  action: string
  confidence: number
  probability: number
  risk: number
  expectedRoiPct: number
  expectedDrawdownPct: number
  reasoning: string
}

function emptyLayer(
  id: ChartLayer['id'],
  sourceEngine: ChartLayer['sourceEngine'],
  visible: boolean,
): ChartLayer {
  return { id, sourceEngine, events: [], status: 'no_data', visible }
}

function fromStoreDecision(d: Decision): ChartAiDecision {
  return {
    action: d.action,
    confidence: Math.round(d.confidence),
    probability: Math.round(d.confidence),
    risk: Math.round(d.risk),
    expectedRoiPct: d.expectedROI ?? 0,
    expectedDrawdownPct: d.expectedDrawdown ?? 0,
    reasoning: d.reasoning,
  }
}

function fromExplainable(d: ReturnType<typeof decide>): ChartAiDecision {
  return {
    action: d.action,
    confidence: d.opportunity.confidence,
    probability: d.opportunity.probability,
    risk: d.opportunity.risk,
    expectedRoiPct: d.opportunity.expectedRoiPct,
    expectedDrawdownPct: d.opportunity.expectedDrawdownPct,
    reasoning: [d.summary, ...d.reasons.slice(0, 3)].filter(Boolean).join(' · '),
  }
}

function nearestCandleTime(
  candles: { time: number }[],
  unixSec: number,
  fallback: number,
): number {
  if (!candles.length) return fallback
  let best = candles[0]!.time
  let bestDist = Math.abs(best - unixSec)
  for (const c of candles) {
    const dist = Math.abs(c.time - unixSec)
    if (dist < bestDist) {
      best = c.time
      bestDist = dist
    }
  }
  return best
}

function zonesFromHistory(
  history: DecisionHistoryPoint[],
  candles: { time: number; close: number }[],
  fallbackPrice: number,
  lastTime: number,
): AiZoneBand[] {
  const zones: AiZoneBand[] = []
  for (const point of history) {
    if (point.action !== 'BUY' && point.action !== 'SELL' && point.action !== 'EXIT') continue
    const ts = Math.floor(new Date(point.at).getTime() / 1000)
    const t = nearestCandleTime(candles, ts, lastTime)
    const near = candles.find((c) => c.time === t)
    const price = near?.close || fallbackPrice
    // Honest band at decision timestamp — not a fake range across all candles
    const span = 120
    if (point.action === 'BUY') {
      zones.push({
        id: `zone-buy:${point.at}`,
        kind: 'buy',
        priceLow: price * 0.97,
        priceHigh: price * (1 + Math.min(0.08, Math.abs(point.confidence) / 1000)),
        timeFrom: t,
        timeTo: t + span,
        confidence: point.confidence,
        sourceEngineRef: `decision-store:zone:buy:${point.at}`,
        label: 'AI Buy Zone',
      })
    } else {
      zones.push({
        id: `zone-sell:${point.at}`,
        kind: 'sell',
        priceLow: price * (1 - Math.min(0.08, point.risk / 1000)),
        priceHigh: price * 1.02,
        timeFrom: t,
        timeTo: t + span,
        confidence: point.confidence,
        sourceEngineRef: `decision-store:zone:sell:${point.at}`,
        label: 'AI Sell Zone',
      })
    }
  }
  return zones
}

function singleZoneAtLastCandle(
  decision: ChartAiDecision,
  whaleBias: string,
  price: number,
  lastTime: number,
  sourcePrefix: string,
): AiZoneBand[] {
  const zones: AiZoneBand[] = []
  const span = 120
  if (decision.action === 'BUY' || decision.expectedRoiPct > 2) {
    zones.push({
      id: `zone-buy:${lastTime}`,
      kind: 'buy',
      priceLow: price * 0.97,
      priceHigh: price * (1 + Math.min(0.08, Math.abs(decision.expectedRoiPct) / 100)),
      timeFrom: lastTime,
      timeTo: lastTime + span,
      confidence: decision.confidence,
      sourceEngineRef: `${sourcePrefix}:zone:buy:${decision.confidence}`,
      label: 'AI Buy Zone',
    })
  }
  if (decision.action === 'SELL' || decision.action === 'EXIT' || whaleBias === 'distributing') {
    zones.push({
      id: `zone-sell:${lastTime}`,
      kind: 'sell',
      priceLow: price * (1 - Math.min(0.08, Math.abs(decision.expectedDrawdownPct) / 100)),
      priceHigh: price * 1.02,
      timeFrom: lastTime,
      timeTo: lastTime + span,
      confidence: decision.confidence,
      sourceEngineRef: `${sourcePrefix}:zone:sell:${decision.confidence}`,
      label: 'AI Sell Zone',
    })
  }
  return zones
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

  // Prefer server Decision store for AI strip; local decide only if empty
  let stored =
    (await getDecisionByTokenId(token.id).catch(() => null)) ??
    (await getDecisionByTokenId(token.symbol).catch(() => null))
  let aiLive = Boolean(stored)
  let decision: ChartAiDecision
  let narrativeText: string
  let sourcePrefix = 'decision-store'

  if (stored) {
    decision = fromStoreDecision(stored)
    narrativeText = stored.reasoning
  } else {
    const explained = decide(null, intel)
    decision = fromExplainable(explained)
    const explainedNarr = explainDecision(explained)
    narrativeText = [explainedNarr.headline, explainedNarr.confidenceLine, ...explainedNarr.bullets.slice(0, 3)]
      .filter(Boolean)
      .join(' · ')
    sourcePrefix = 'decision-engine'
    // Optionally persist so subsequent chart / Layer 4 reads share the same Decision
    try {
      const canonical = toCanonicalDecision(explained, { tokenAddress: token.id })
      await saveDecision(canonical)
      stored = canonical
      aiLive = true
      sourcePrefix = 'decision-store'
      decision = fromStoreDecision(canonical)
      narrativeText = canonical.reasoning
    } catch {
      /* Redis optional */
    }
  }

  const history = await getDecisionHistory(token.id).catch(() => [] as DecisionHistoryPoint[])
  const historyAlt =
    history.length === 0
      ? await getDecisionHistory(token.symbol).catch(() => [] as DecisionHistoryPoint[])
      : history

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

  // ── Layer 5 AI (Decision store + Explainable engines) ──
  const aiEvents: ChartEvent[] = [
    {
      id: `ai-decision:${decision.confidence}:${lastTime}`,
      timestamp: lastTime,
      price,
      severity: decision.action === 'BUY' || decision.action === 'SELL' ? 'notable' : 'info',
      label: `AI ${decision.action} · confidence ${decision.confidence}`,
      detail: narrativeText,
      sourceEngineRef: `${sourcePrefix}:${decision.confidence}:${decision.action}`,
      layerId: 'ai',
    },
  ]

  const aiZones: AiZoneBand[] =
    historyAlt.length > 0
      ? zonesFromHistory(historyAlt, candles, price, lastTime)
      : singleZoneAtLastCandle(decision, intel.whaleBias, price, lastTime, sourcePrefix)

  const aiStrip: AiStripPoint[] = candles.length
    ? sampleStrip(candles, decision, intel, lastTime, sourcePrefix)
    : [
        {
          time: lastTime,
          confidence: decision.confidence,
          conviction: decision.probability,
          risk: decision.risk,
          trend: clamp(50 + token.change24hPct, 0, 100),
          sourceEngineRef: `${sourcePrefix}:strip:${decision.confidence}`,
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
    sourcePrefix,
  })

  // demo reflects candle/token provenance only — AI live from store is not demo-labeled
  const candlesDemo = Boolean(candlesEnv.demo || tokensEnv.demo)

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
    demo: candlesDemo,
    aiLive,
    source: `intelligence-chart+${candlesEnv.source}${aiLive ? '+decision-store' : ''}`,
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
  decision: ChartAiDecision,
  intel: ReturnType<typeof buildMarketIntel>,
  lastTime: number,
  sourcePrefix: string,
): AiStripPoint[] {
  // Sparse real samples: only emit points at candle times with the same live engine scores
  // (no fabricated historical AI series — strip is flat until we have time-series decisions)
  const step = Math.max(1, Math.floor(candles.length / 12))
  const out: AiStripPoint[] = []
  for (let i = 0; i < candles.length; i += step) {
    const c = candles[i]!
    out.push({
      time: c.time,
      confidence: decision.confidence,
      conviction: decision.probability,
      risk: decision.risk,
      trend: clamp(50 + (intel.predictionUpsidePct ?? 0), 0, 100),
      sourceEngineRef: `${sourcePrefix}:strip:${decision.confidence}:${c.time}`,
    })
  }
  if (!out.length || out[out.length - 1]!.time !== lastTime) {
    out.push({
      time: lastTime,
      confidence: decision.confidence,
      conviction: decision.probability,
      risk: decision.risk,
      trend: clamp(50 + (intel.predictionUpsidePct ?? 0), 0, 100),
      sourceEngineRef: `${sourcePrefix}:strip:${decision.confidence}:${lastTime}`,
    })
  }
  return out
}

function buildSidebarTimeline(input: {
  candles: { time: number }[]
  decision: ChartAiDecision
  intel: ReturnType<typeof buildMarketIntel>
  narrative: string
  scanSafety: number | null
  holderHealth: number | null
  sourcePrefix: string
}): IntelligenceSidebarState[] {
  const { decision, intel, narrative, scanSafety, holderHealth, candles, sourcePrefix } = input
  if (!candles.length) {
    return [
      {
        timestamp: Math.floor(Date.now() / 1000),
        aiConviction: decision.probability,
        risk: decision.risk,
        confidence: decision.confidence,
        narrative,
        trend: clamp(50 + (intel.predictionUpsidePct ?? 0), 0, 100),
        smartMoneyActivity: intel.smartMoneyScore,
        whalePressure: intel.whaleBias,
        holderHealth,
        sourceRefs: [
          `${sourcePrefix}:${decision.confidence}`,
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
      aiConviction: decision.probability,
      risk: decision.risk,
      confidence: decision.confidence,
      narrative,
      trend: clamp(50 + (intel.predictionUpsidePct ?? 0), 0, 100),
      smartMoneyActivity: intel.smartMoneyScore,
      whalePressure: intel.whaleBias,
      holderHealth,
      sourceRefs: [
        `${sourcePrefix}:${decision.confidence}:${t}`,
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
