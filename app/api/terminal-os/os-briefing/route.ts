/**
 * GET /api/terminal-os/os-briefing?wallet=
 * Single Decision-Engine-driven briefing for the AI Operating System.
 * Never fabricates Fear/Greed, whale, or recommendation numbers.
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Decision } from '@cryptocheck/decision-contracts'
import { greetingForNow } from '@/features/ai-os/lib/greeting'
import type {
  OsBriefing,
  OsCoachLine,
  OsMarketSignal,
  OsRecommendation,
} from '@/features/ai-os/types'
import { listRecentDecisions } from '@/lib/terminal-os/decision-store'
import { runDecisionTick } from '@/lib/terminal-os/decision-engine-tick'
import { getPersistedDna } from '@/lib/terminal-os/dna-store'
import { resilientOverview, resilientTokens, resilientWhales } from '@/lib/terminal-os/resilient-feed'
import { buildHoldingsResponse } from '@/lib/portfolio-desk/holdings-service'
import { isValidSolanaWallet } from '@/lib/portfolio-desk/validate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type FngPayload = {
  data?: Array<{ value?: string; value_classification?: string }>
}

async function fetchFearGreed(): Promise<{ value: number; label: string } | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6_000),
    })
    if (!res.ok) return null
    const body = (await res.json()) as FngPayload
    const row = body.data?.[0]
    const value = Number(row?.value)
    if (!Number.isFinite(value)) return null
    return {
      value: Math.round(value),
      label: row?.value_classification?.trim() || 'Index',
    }
  } catch {
    return null
  }
}

function pickRecommendation(decisions: Decision[]): OsRecommendation {
  if (!decisions.length) {
    return {
      kind: 'unavailable',
      headline: 'Decision Engine has not published a recommendation yet.',
      detail: 'Waiting for the next server tick — no fabricated score shown.',
      confidence: null,
      action: null,
      symbol: null,
      decisionId: null,
      confidenceMode: null,
    }
  }

  const buy = decisions.find(
    (d) => d.action === 'BUY' && (d.marketConfidence ?? d.confidence) >= 70,
  )
  if (buy) {
    const conf = buy.marketConfidence ?? buy.confidence
    const symbol = buy.subject.kind === 'token' ? buy.subject.symbol : null
    return {
      kind: 'opportunity',
      headline: `I found one high-confidence opportunity${symbol ? ` on $${symbol}` : ''}.`,
      detail: buy.reasoning.slice(0, 220),
      confidence: conf,
      action: buy.action,
      symbol,
      decisionId: buy.id,
      confidenceMode: buy.confidenceMode,
    }
  }

  const wait = decisions.find((d) => d.action === 'WAIT' || d.action === 'DO_NOTHING')
  const top = wait ?? decisions[0]!
  const conf = top.marketConfidence ?? top.confidence
  return {
    kind: 'wait',
    headline: 'I recommend waiting.',
    detail: top.reasoning.slice(0, 220),
    confidence: conf,
    action: top.action,
    symbol: top.subject.kind === 'token' ? top.subject.symbol : null,
    decisionId: top.id,
    confidenceMode: top.confidenceMode,
  }
}

function buildCoachLines(opts: {
  wallet: string | null
  dnaAvailable: boolean
  dnaStyle: string | null
  sampleSize: number
  holdingCount: number
  highConviction: Decision[]
  forming: Decision[]
  solLiquidity: string | null
}): OsCoachLine[] {
  const lines: OsCoachLine[] = []

  if (opts.wallet) {
    lines.push({
      id: 'monitor',
      text: 'I have been monitoring your wallet.',
    })
  } else {
    lines.push({
      id: 'connect',
      text: 'Connect a wallet so I can ground coaching in your DNA and holdings.',
    })
  }

  if (opts.dnaAvailable && opts.dnaStyle) {
    lines.push({
      id: 'dna',
      text: `Your Trader DNA reads as ${opts.dnaStyle} (sample ${opts.sampleSize}).`,
    })
  } else if (opts.wallet) {
    lines.push({
      id: 'dna-missing',
      text: 'Trader DNA is not trained yet — market-quality Decisions still apply.',
    })
  }

  if (opts.holdingCount > 0) {
    lines.push({
      id: 'portfolio',
      text: `Portfolio shows ${opts.holdingCount} open token balance${opts.holdingCount === 1 ? '' : 's'}.`,
    })
  }

  if (opts.highConviction.length > 0) {
    const n = opts.highConviction.length
    lines.push({
      id: 'high-conf',
      text:
        n === 1
          ? 'One high-confidence Decision is on the board right now.'
          : `${n} high-confidence Decisions are on the board right now.`,
    })
  }

  if (opts.solLiquidity) {
    lines.push({ id: 'liq', text: opts.solLiquidity })
  }

  if (opts.forming.length > 0) {
    const sym =
      opts.forming[0]!.subject.kind === 'token' ? opts.forming[0]!.subject.symbol : null
    lines.push({
      id: 'forming',
      text: sym
        ? `One opportunity is forming around $${sym}.`
        : 'One opportunity is forming.',
    })
  }

  if (lines.length < 2) {
    lines.push({
      id: 'watching',
      text: 'Watching live market context through the Decision Engine.',
    })
  }

  return lines.slice(0, 6)
}

export async function GET(req: NextRequest) {
  const walletRaw = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  const wallet =
    walletRaw && isValidSolanaWallet(walletRaw) ? walletRaw : walletRaw || null

  try {
    let decisions = await listRecentDecisions(16)
    if (!decisions.length) {
      const tick = await runDecisionTick({ wallet, limit: 12 })
      decisions = tick.decisions
    }

    const [overviewEnv, tokensEnv, whalesEnv, fng, dna, holdings] = await Promise.all([
      resilientOverview(),
      resilientTokens('solana', 12),
      resilientWhales(16),
      fetchFearGreed(),
      wallet && isValidSolanaWallet(wallet) ? getPersistedDna(wallet).catch(() => null) : Promise.resolve(null),
      wallet && isValidSolanaWallet(wallet)
        ? buildHoldingsResponse(wallet).catch(() => null)
        : Promise.resolve(null),
    ])

    const tokens = tokensEnv.data ?? []
    const whales = whalesEnv.data ?? []
    const overview = overviewEnv.data
    const demo = Boolean(tokensEnv.demo || whalesEnv.demo || overviewEnv.demo)
    const stale = Boolean(tokensEnv.stale || whalesEnv.stale || overviewEnv.stale)

    const fngValue = fng?.value ?? null
    const fear: OsMarketSignal = {
      id: 'fear',
      label: 'Fear',
      value: fngValue != null && fngValue < 45 ? String(fngValue) : null,
      detail: fngValue != null && fngValue < 45 ? fng!.label : null,
      available: fngValue != null && fngValue < 45,
    }
    const greed: OsMarketSignal = {
      id: 'greed',
      label: 'Greed',
      value: fngValue != null && fngValue >= 45 ? String(fngValue) : null,
      detail: fngValue != null && fngValue >= 45 ? fng!.label : null,
      available: fngValue != null && fngValue >= 45,
    }
    // Always expose both slots honestly — inactive side shows unavailable
    if (fngValue != null) {
      fear.available = fngValue < 50
      greed.available = fngValue >= 50
      if (fear.available) {
        fear.value = String(fngValue)
        fear.detail = fng!.label
      } else {
        fear.value = null
        fear.detail = 'Not dominant'
      }
      if (greed.available) {
        greed.value = String(fngValue)
        greed.detail = fng!.label
      } else {
        greed.value = null
        greed.detail = 'Not dominant'
      }
    } else {
      fear.available = false
      fear.value = null
      fear.detail = 'Index unavailable'
      greed.available = false
      greed.value = null
      greed.detail = 'Index unavailable'
    }

    const whaleBiasAccum = whales.filter(
      (w) =>
        w.classification === 'Accumulation' ||
        w.classification === 'High Conviction Buy' ||
        w.action === 'buy' ||
        w.action === 'deposit',
    ).length
    const whaleBiasDist = whales.filter(
      (w) =>
        w.classification === 'Distribution' ||
        w.classification === 'Profit Taking' ||
        w.action === 'sell' ||
        w.action === 'withdraw',
    ).length
    const whalesSignal: OsMarketSignal = whales.length
      ? {
          id: 'whales',
          label: 'Whales',
          value:
            whaleBiasAccum === whaleBiasDist
              ? 'Mixed'
              : whaleBiasAccum > whaleBiasDist
                ? 'Accumulating'
                : 'Distributing',
          detail: `${whales.length} live flow events · ${whalesEnv.demo ? 'sample/proxy' : whalesEnv.source || 'live'}`,
          available: true,
        }
      : {
          id: 'whales',
          label: 'Whales',
          value: null,
          detail: 'No live whale/flow events',
          available: false,
        }

    const smartScores = whales
      .map((w) => w.smartMoneyScore)
      .filter((n) => typeof n === 'number' && n > 0)
    const avgSmart = smartScores.length
      ? Math.round(smartScores.reduce((a, b) => a + b, 0) / smartScores.length)
      : null
    const smFromDecision = decisions
      .flatMap((d) => d.contributingFactors)
      .find((f) => /smart|whale|market quality/i.test(f.summary))
    const smartMoney: OsMarketSignal =
      avgSmart != null
        ? {
            id: 'smart_money',
            label: 'Smart Money',
            value: String(avgSmart),
            detail: smFromDecision?.summary ?? 'Avg smart-money score on live whale/flow events',
            available: true,
          }
        : smFromDecision
          ? {
              id: 'smart_money',
              label: 'Smart Money',
              value: null,
              detail: smFromDecision.summary,
              available: true,
            }
          : {
              id: 'smart_money',
              label: 'Smart Money',
              value: null,
              detail: 'Awaiting live smart-money signal',
              available: false,
            }

    const topMove = [...tokens].sort(
      (a, b) => Math.abs(b.change24hPct ?? 0) - Math.abs(a.change24hPct ?? 0),
    )[0]
    const narrative: OsMarketSignal = topMove
      ? {
          id: 'narrative',
          label: 'Narrative',
          value: `$${topMove.symbol}`,
          detail: `${(topMove.change24hPct ?? 0) >= 0 ? '+' : ''}${(topMove.change24hPct ?? 0).toFixed(1)}% 24h · liq $${Math.round(topMove.liquidityUsd ?? 0).toLocaleString()}`,
          available: true,
        }
      : overview
        ? {
            id: 'narrative',
            label: 'Narrative',
            value: 'Market',
            detail: `Cap ${(overview.marketCapChange24hPct ?? 0) >= 0 ? '+' : ''}${(overview.marketCapChange24hPct ?? 0).toFixed(1)}% 24h`,
            available: true,
          }
        : {
            id: 'narrative',
            label: 'Narrative',
            value: null,
            detail: 'No live narrative signal',
            available: false,
          }

    const market: OsMarketSignal[] = [fear, greed, whalesSignal, smartMoney, narrative]

    const highConviction = decisions.filter(
      (d) =>
        (d.action === 'BUY' || d.action === 'SELL') &&
        (d.marketConfidence ?? d.confidence) >= 70,
    )
    const forming = decisions.filter(
      (d) => d.action === 'WAIT' && (d.marketConfidence ?? d.confidence) >= 55,
    )

    const sol = tokens.find((t) => t.symbol.toUpperCase() === 'SOL')
    const solLiquidity =
      sol && sol.liquidityUsd
        ? `SOL liquidity is ${sol.change24hPct != null && sol.change24hPct > 0 ? 'increasing' : 'in focus'} · $${Math.round(sol.liquidityUsd).toLocaleString()} pool depth.`
        : null

    const dnaAvailable = Boolean(dna && dna.sampleSize >= 3)
    const holdingCount = holdings?.holdings?.length ?? 0

    const briefing: OsBriefing = {
      greeting: greetingForNow(),
      coachLines: buildCoachLines({
        wallet,
        dnaAvailable,
        dnaStyle: dna?.tradingStyleSummary ?? null,
        sampleSize: dna?.sampleSize ?? 0,
        holdingCount,
        highConviction,
        forming,
        solLiquidity,
      }),
      market,
      recommendation: pickRecommendation(decisions),
      decision:
        decisions.find((d) => d.action === 'BUY' && (d.marketConfidence ?? d.confidence) >= 70) ??
        decisions.find((d) => d.action === 'WAIT') ??
        decisions[0] ??
        null,
      decisions,
      dna: {
        available: dnaAvailable,
        sampleSize: dna?.sampleSize ?? 0,
        styleSummary: dna?.tradingStyleSummary ?? null,
        confidence: dna?.confidence ?? null,
      },
      portfolio: {
        available: holdings != null,
        holdingCount,
        totalUsd: holdings?.totalValueUsd ?? null,
      },
      provenance: {
        demo,
        stale,
        source: demo ? 'demo-fallback' : 'decision-engine+live-market',
        computedAt: new Date().toISOString(),
      },
      insufficient: decisions.length === 0,
      message: decisions.length === 0 ? 'Waiting for Decision Engine tick.' : null,
    }

    return NextResponse.json(briefing, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (e) {
    return NextResponse.json(
      {
        greeting: greetingForNow(),
        coachLines: [],
        market: [],
        recommendation: {
          kind: 'unavailable',
          headline: 'Briefing unavailable',
          detail: e instanceof Error ? e.message : 'os-briefing failed',
          confidence: null,
          action: null,
          symbol: null,
          decisionId: null,
          confidenceMode: null,
        },
        decision: null,
        decisions: [],
        dna: { available: false, sampleSize: 0, styleSummary: null, confidence: null },
        portfolio: { available: false, holdingCount: 0, totalUsd: null },
        provenance: {
          demo: false,
          stale: true,
          source: 'error',
          computedAt: new Date().toISOString(),
        },
        insufficient: true,
        message: e instanceof Error ? e.message : 'os-briefing failed',
      } satisfies OsBriefing,
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }
}
