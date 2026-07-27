/**
 * Phase 17.2 — Market Analyst briefing (presentation only).
 * Cognitive order: Reconstruction → Executive Conclusion → ≤3 Decisions
 *   → Evidence per decision → Charts → Raw data.
 * Never invents market moves. Quiet tape → say so.
 */

import type { ScreenerRow } from '@/lib/providers/types'

export type MarketMacroQuotes = {
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
  source?: string
}

export type MarketEvidence = {
  metrics: Array<{ label: string; value: string }>
  movers: Array<{
    symbol: string
    mint: string
    change24hPct: number
    volume24hUsd: number
    note: string
  }>
  spark: number[]
  unavailableReason: string | null
}

export type MarketProcessStep = {
  id: string
  label: string
  status: string
  done: boolean
}

/** One elevation the analyst speaks — What / Why / Do + confidence from engines. */
export type MarketDecision = {
  id: string
  /** Short subject line for conviction wording — not a UI title. */
  focus: string
  whatHappened: string
  whyItMatters: string
  whatToDo: string
  /** 0–100 from existing sample size, agreement, smart-money, AI, risk scores. */
  confidencePct: number
  evidence: MarketEvidence
}

export type MarketTemperature =
  | 'Healthy'
  | 'Aggressive'
  | 'Defensive'
  | 'Uncertain'
  | 'Mixed'

export type MarketAnalystBrief = {
  reconstruction: MarketProcessStep[]
  /** Opening line — Chief Market Strategist voice. */
  openingLine: string
  /** Single executive read after analysis finished. */
  executiveConclusion: string
  executiveWhy: string
  temperature: MarketTemperature
  temperatureLine: string
  quiet: boolean
  decisions: MarketDecision[]
  /** Closing conviction — never invented when confidence is low. */
  convictionLine: string
  sampleSpark: number[]
  sourcesNote: string
  unavailableReason: string | null
  fetchedHint: string | null
}

const UNAVAILABLE = 'Not enough real market data available yet.'

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function confidenceFromEngineRows(rows: ScreenerRow[]): number {
  if (!rows.length) return 12
  const n = rows.length
  const sampleFactor = Math.min(1, n / 12) * 35
  const chgs = rows.map((r) => r.change24hPct).filter((x) => Number.isFinite(x))
  const a = avg(chgs)
  let agreeFactor = 0
  if (a != null && chgs.length) {
    const sign = Math.sign(a) || 0
    const agree =
      sign === 0
        ? chgs.filter((c) => Math.abs(c) < 1.5).length / chgs.length
        : chgs.filter((c) => Math.sign(c) === sign || Math.abs(c) < 1).length / chgs.length
    agreeFactor = agree * 28
  }
  const smart = avg(rows.map((r) => r.smartMoneyScore).filter((x) => Number.isFinite(x))) ?? 0
  const ai = avg(rows.map((r) => r.aiScore).filter((x) => Number.isFinite(x))) ?? 0
  const risk = avg(rows.map((r) => r.riskScore).filter((x) => Number.isFinite(x))) ?? 50
  const scoreFactor = (smart / 100) * 18 + (ai / 100) * 12 + ((100 - Math.min(100, risk)) / 100) * 12
  return Math.round(Math.min(97, Math.max(10, sampleFactor + agreeFactor + scoreFactor)))
}

function confidenceFromMacro(q: MarketMacroQuotes): number {
  let pts = 20
  if (q.btcChangePct != null) pts += 25
  if (q.solChangePct != null) pts += 20
  if (q.marketCapChangePct != null) pts += 15
  if (q.fearGreed != null) pts += 10
  return Math.min(88, pts)
}

function deriveTemperature(params: {
  aChg: number | null
  aBuy: number | null
  sampleSize: number
  sparseScores: boolean
}): MarketTemperature {
  const { aChg, aBuy, sampleSize, sparseScores } = params
  if (sampleSize < 3 || sparseScores) return 'Uncertain'
  if (aChg != null && aChg > 3 && aBuy != null && aBuy >= 1.15) return 'Aggressive'
  if (aChg != null && aChg < -2) return 'Defensive'
  if (aBuy != null && aBuy < 0.88) return 'Defensive'
  if (
    aChg != null &&
    Math.abs(aChg) >= 2 &&
    aBuy != null &&
    ((aChg > 0 && aBuy < 0.95) || (aChg < 0 && aBuy > 1.1))
  ) {
    return 'Mixed'
  }
  if (aChg != null && Math.abs(aChg) < 2 && (aBuy == null || (aBuy >= 0.9 && aBuy <= 1.12))) {
    return 'Healthy'
  }
  if (aChg != null && Math.abs(aChg) >= 2) return 'Mixed'
  return 'Uncertain'
}

function temperatureSpeech(t: MarketTemperature): string {
  switch (t) {
    case 'Healthy':
      return 'Market temperature is Healthy — breadth is orderly, not chasing.'
    case 'Aggressive':
      return 'Market temperature is Aggressive — strength and bid pressure are both elevated.'
    case 'Defensive':
      return 'Market temperature is Defensive — the sample is protecting capital, not expanding risk.'
    case 'Mixed':
      return 'Market temperature is Mixed — direction and flow are not telling the same story.'
    case 'Uncertain':
      return 'Market temperature is Uncertain — the sample is too thin or too split to lean hard.'
  }
}

function buildConviction(decisions: MarketDecision[], quiet: boolean): string {
  if (quiet || decisions.length === 0) {
    return 'I don’t currently have a high-conviction opportunity.'
  }
  const ranked = [...decisions].sort((a, b) => b.confidencePct - a.confidencePct)
  const best = ranked[0]!
  if (
    best.confidencePct < 70 ||
    (best.id === 'tape' && /quiet|noise|significant market change/i.test(best.whatHappened))
  ) {
    return 'I don’t currently have a high-conviction opportunity.'
  }
  return `If I had to focus on only one opportunity today, it would be ${best.focus}.`
}

function emptyBriefShell(
  reconstruction: MarketProcessStep[],
  partial: Partial<MarketAnalystBrief> &
    Pick<MarketAnalystBrief, 'executiveConclusion' | 'executiveWhy' | 'quiet'>,
): MarketAnalystBrief {
  return {
    reconstruction,
    openingLine: partial.openingLine ?? "I'm still waiting on a usable market sample.",
    executiveConclusion: partial.executiveConclusion,
    executiveWhy: partial.executiveWhy,
    temperature: partial.temperature ?? 'Uncertain',
    temperatureLine:
      partial.temperatureLine ?? temperatureSpeech(partial.temperature ?? 'Uncertain'),
    quiet: partial.quiet,
    decisions: partial.decisions ?? [],
    convictionLine:
      partial.convictionLine ?? 'I don’t currently have a high-conviction opportunity.',
    sampleSpark: partial.sampleSpark ?? [],
    sourcesNote:
      partial.sourcesNote ??
      'Birdeye · Jupiter · Helius · Raydium · CoinGecko / Fear&Greed (existing routes)',
    unavailableReason: partial.unavailableReason ?? null,
    fetchedHint: partial.fetchedHint ?? null,
  }
}

function emptyEvidence(reason = UNAVAILABLE): MarketEvidence {
  return { metrics: [], movers: [], spark: [], unavailableReason: reason }
}

function moversFrom(rows: ScreenerRow[], limit = 4): MarketEvidence['movers'] {
  return [...rows]
    .sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))
    .slice(0, limit)
    .map((r) => ({
      symbol: r.symbol || r.mint.slice(0, 4),
      mint: r.mint,
      change24hPct: r.change24hPct,
      volume24hUsd: r.volume24hUsd,
      note:
        r.smartMoneyScore >= 60
          ? 'Elevated smart-money score in live sample'
          : r.buySellRatio >= 1.15
            ? 'Buy-side ratio elevated in live sample'
            : r.buySellRatio > 0 && r.buySellRatio < 0.85
              ? 'Sell-side pressure in live sample'
              : 'Live sample move',
    }))
}

function evidenceFromRows(rows: ScreenerRow[]): MarketEvidence {
  if (!rows.length) return emptyEvidence()
  const chgs = rows.map((r) => r.change24hPct).filter((n) => Number.isFinite(n))
  const vols = rows.map((r) => r.volume24hUsd).filter((n) => Number.isFinite(n) && n > 0)
  const liqs = rows.map((r) => r.liquidityUsd).filter((n) => Number.isFinite(n) && n > 0)
  const buys = rows.map((r) => r.buySellRatio).filter((n) => Number.isFinite(n) && n > 0)
  const smart = rows.map((r) => r.smartMoneyScore).filter((n) => Number.isFinite(n))
  const aChg = avg(chgs)
  const aVol = avg(vols)
  const aLiq = avg(liqs)
  const aBuy = avg(buys)
  const aSmart = avg(smart)
  return {
    metrics: [
      aChg != null ? { label: 'Sample 24h avg', value: fmtPct(aChg) } : null,
      aVol != null ? { label: 'Sample avg volume', value: fmtUsd(aVol) } : null,
      aLiq != null ? { label: 'Sample avg liquidity', value: fmtUsd(aLiq) } : null,
      aBuy != null ? { label: 'Avg buy/sell ratio', value: aBuy.toFixed(2) } : null,
      aSmart != null ? { label: 'Avg smart-money score', value: aSmart.toFixed(0) } : null,
      { label: 'Tokens in sample', value: String(rows.length) },
    ].filter(Boolean) as Array<{ label: string; value: string }>,
    movers: moversFrom(rows),
    spark: chgs.slice(0, 12),
    unavailableReason: null,
  }
}

function buildReconstruction(params: {
  rows: ScreenerRow[]
  quotes: MarketMacroQuotes | null
  loading: boolean
  source?: string | null
}): MarketProcessStep[] {
  const { rows, quotes: q, loading, source } = params
  return [
    {
      id: 'screener',
      label: 'Live Solana book',
      status: loading
        ? 'Still reading…'
        : rows.length > 0
          ? `In — ${rows.length} names${source ? ` via ${source}` : ''}.`
          : 'Empty.',
      done: !loading,
    },
    {
      id: 'flow',
      label: 'Flow & smart money',
      status: loading
        ? 'Still reading…'
        : rows.some((r) => r.buySellRatio > 0 || r.smartMoneyScore > 0)
          ? 'In.'
          : 'Thin.',
      done: !loading,
    },
    {
      id: 'macro',
      label: 'Macro tape',
      status: loading
        ? 'Still reading…'
        : q && (q.btcChangePct != null || q.fearGreed != null)
          ? 'In.'
          : 'Incomplete.',
      done: !loading,
    },
    {
      id: 'filter',
      label: 'What deserves attention',
      status: loading ? 'Filtering…' : 'Done — speaking next.',
      done: !loading,
    },
  ]
}

export type MarketAnalystInput = {
  screenerRows: ScreenerRow[]
  quotes: MarketMacroQuotes | null
  available?: boolean
  source?: string | null
  loading?: boolean
}

/**
 * Build ≤3 elevations from live engines. Quiet tape → say so. Never invent.
 * Presentation fields only — confidence/temperature derived from existing scores.
 */
export function buildMarketAnalystBrief(input: MarketAnalystInput): MarketAnalystBrief {
  const loading = Boolean(input.loading)
  const rows = (input.screenerRows ?? []).filter((r) => r.mint && r.mint.length >= 32)
  const q = input.quotes
  const sourcesNote = 'Birdeye · Jupiter · Helius · Raydium · CoinGecko / Fear&Greed (existing routes)'
  const reconstruction = buildReconstruction({
    rows,
    quotes: q,
    loading,
    source: input.source,
  })

  if (loading) {
    return emptyBriefShell(reconstruction, {
      openingLine: "I'm finishing today's market read.",
      executiveConclusion: 'Almost ready — holding the call until the live sample lands.',
      executiveWhy: 'I will not speak a conviction from an incomplete book.',
      quiet: false,
      temperature: 'Uncertain',
      sourcesNote,
      fetchedHint: input.source ?? null,
    })
  }

  if (!rows.length && !q) {
    return emptyBriefShell(reconstruction, {
      openingLine: "I've checked the market routes.",
      executiveConclusion: UNAVAILABLE,
      executiveWhy: 'Existing market routes returned nothing usable — I will not invent a tape.',
      quiet: true,
      temperature: 'Uncertain',
      unavailableReason: UNAVAILABLE,
      sourcesNote,
      fetchedHint: input.source ?? null,
    })
  }

  const chgs = rows.map((r) => r.change24hPct).filter((n) => Number.isFinite(n))
  const aChg = avg(chgs)
  const buys = rows.map((r) => r.buySellRatio).filter((n) => n > 0)
  const aBuy = avg(buys)
  const smart = rows.map((r) => r.smartMoneyScore).filter((n) => Number.isFinite(n))
  const aSmart = avg(smart)
  const top = [...rows].sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))[0]
  const sparseScores =
    rows.length > 0 &&
    !rows.some((r) => r.smartMoneyScore > 0 || r.aiScore > 0 || r.buySellRatio > 0)

  const tapeSignificant = aChg != null && Math.abs(aChg) >= 2
  const flowSignificant = aBuy != null && (aBuy >= 1.12 || aBuy < 0.88)
  const macroSignificant =
    (q?.btcChangePct != null && Math.abs(q.btcChangePct) >= 1.5) ||
    (q?.fearGreed != null && (q.fearGreed >= 65 || q.fearGreed <= 30)) ||
    (q?.marketCapChangePct != null && Math.abs(q.marketCapChangePct) >= 1.5)

  const quiet =
    rows.length > 0 && !tapeSignificant && !flowSignificant && !macroSignificant

  const temperature = deriveTemperature({
    aChg,
    aBuy,
    sampleSize: rows.length,
    sparseScores,
  })
  const baseConf = confidenceFromEngineRows(rows)

  const decisions: MarketDecision[] = []

  if (rows.length > 0) {
    if (quiet) {
      decisions.push({
        id: 'tape',
        focus: 'waiting for a real imprint',
        whatHappened: 'Most of today’s movement is noise — nothing in the live sample clears a significance bar.',
        whyItMatters:
          'Quiet sessions are information. Inventing urgency here is how capital gets spent on nothing.',
        whatToDo:
          'Do nothing aggressive. Keep the book open; come back when breadth or flow breaks this quiet band.',
        confidencePct: Math.min(92, Math.max(baseConf, 78)),
        evidence: evidenceFromRows(rows),
      })
    } else if (aChg != null && aChg > 2) {
      decisions.push({
        id: 'tape',
        focus: top?.symbol
          ? `${top.symbol} and the Solana strength cluster`
          : 'Solana sample strength',
        whatHappened: 'Solana breadth strengthened — advances outweigh declines in the live sample.',
        whyItMatters:
          top?.symbol != null
            ? `Attention concentrates around ${top.symbol}. That is where the tape is loudest today.`
            : 'Positive aggregate change is visible — but only volume leaders make it durable.',
        whatToDo:
          'Inspect the leading names for confirmation. Do not extrapolate strength from a single print.',
        confidencePct: baseConf,
        evidence: evidenceFromRows(rows),
      })
    } else if (aChg != null && aChg < -2) {
      decisions.push({
        id: 'tape',
        focus: top?.symbol
          ? `${top.symbol} and defensive Solana flow`
          : 'defensive Solana breadth',
        whatHappened: 'Solana turned defensive — declines outweigh advances in the live sample.',
        whyItMatters:
          top?.symbol != null
            ? `Pressure is loudest in ${top.symbol}. That is the name that can hurt you first.`
            : 'Negative aggregate change is visible — bounce hunting is the expensive mistake.',
        whatToDo:
          'Treat bounces as suspect until sell pressure cools. Review liquidity exits before adding risk.',
        confidencePct: baseConf,
        evidence: evidenceFromRows(rows),
      })
    }
  }

  if (flowSignificant && aBuy != null && decisions.length < 3) {
    if (aBuy >= 1.12 && (aSmart == null || aSmart < 55)) {
      decisions.push({
        id: 'flow',
        focus: 'newer bid flow without a smart-money stamp',
        whatHappened:
          'Buying pressure rose in the live sample — without a strong smart-money stamp.',
        whyItMatters:
          'Elevated buy/sell with moderate smart-money scores usually means newer flow: attention without institutional confirmation.',
        whatToDo:
          'Size cautiously. Prefer names where volume and liquidity both confirm; do not chase a ratio spike alone.',
        confidencePct: Math.round((baseConf + (aSmart ?? 30)) / 2),
        evidence: evidenceFromRows(rows),
      })
    } else if (aBuy >= 1.12 && aSmart != null && aSmart >= 55) {
      decisions.push({
        id: 'flow',
        focus: 'structured bid with elevated smart-money scores',
        whatHappened:
          'Buying pressure rose alongside elevated smart-money scores in the sample.',
        whyItMatters:
          'When flow and smart-money lean the same way, the move is more structured than a retail chase.',
        whatToDo:
          'Focus review on the higher smart-money names. Still simulate risk before any size.',
        confidencePct: Math.min(96, Math.round((baseConf + aSmart) / 2 + 8)),
        evidence: evidenceFromRows(rows),
      })
    } else if (aBuy < 0.88) {
      decisions.push({
        id: 'flow',
        focus: 'sell-side pressure in the sample',
        whatHappened: 'Sell-side pressure is more visible than demand in today’s sample.',
        whyItMatters: `Average buy/sell sits at ${aBuy.toFixed(2)} — below parity across measured tokens.`,
        whatToDo:
          'Do not lean into weakness without a liquidity reclaim. Wait for the ratio to normalize.',
        confidencePct: baseConf,
        evidence: evidenceFromRows(rows),
      })
    }
  }

  if (macroSignificant && q && decisions.length < 3) {
    if (q.btcChangePct != null && Math.abs(q.btcChangePct) >= 1.5) {
      const btc = q.btcChangePct
      const sol = q.solChangePct
      let what: string
      let why: string
      let action: string
      let focus: string
      if (btc > 1.5 && (sol == null || sol < btc - 0.5)) {
        what = 'Bitcoin is absorbing relative strength versus Solana in today’s quotes.'
        why = 'When BTC leads and SOL lags, alt liquidity often rotates up — or stalls.'
        action =
          'Assume Solana beta may lag until relative strength reappears. Do not invent a Solana breakout from BTC alone.'
        focus = 'Bitcoin relative strength versus Solana'
      } else if (sol != null && sol > btc + 1) {
        what = 'Solana is outperforming Bitcoin on the day in the quote set.'
        why = 'Relative SOL strength means today’s Solana tape is not just a BTC shadow.'
        action = 'Judge Solana names on their own sample — BTC is not the whole story in this window.'
        focus = 'Solana relative strength versus Bitcoin'
      } else if (btc < -1.5) {
        what = 'Bitcoin softens in the macro quote set — risk appetite is under pressure.'
        why =
          sol != null
            ? `SOL sits at ${fmtPct(sol)} beside BTC ${fmtPct(btc)}.`
            : `BTC prints ${fmtPct(btc)}; SOL was not returned.`
        action =
          'Raise the bar for new risk until BTC stabilizes or Solana clearly decouples in the sample.'
        focus = 'defensive macro risk appetite'
      } else {
        what = 'Bitcoin’s day move is material, but it is not cleanly dominating Solana.'
        why = 'Relative BTC/SOL prints are mixed — treat the Solana sample as primary.'
        action = 'Stay with Solana sample leaders; do not force a BTC-led narrative.'
        focus = 'mixed BTC–SOL relative tape'
      }
      const metrics: MarketEvidence['metrics'] = [{ label: 'BTC 24h', value: fmtPct(btc) }]
      if (sol != null) metrics.push({ label: 'SOL 24h', value: fmtPct(sol) })
      decisions.push({
        id: 'macro',
        focus,
        whatHappened: what,
        whyItMatters: why,
        whatToDo: action,
        confidencePct: confidenceFromMacro(q),
        evidence: {
          metrics,
          movers: [],
          spark: [btc, sol ?? 0].filter((n) => Number.isFinite(n)),
          unavailableReason: null,
        },
      })
    } else if (q.fearGreed != null && (q.fearGreed >= 65 || q.fearGreed <= 30)) {
      // Still use F&G as evidence input only — temperature stays breadth/flow derived.
      const v = q.fearGreed
      decisions.push({
        id: 'sentiment',
        focus: v >= 65 ? 'stretched optimism in the quote set' : 'stretched fear in the quote set',
        whatHappened:
          v >= 65
            ? 'The sentiment print is stretched toward greed.'
            : 'The sentiment print is stretched toward fear.',
        whyItMatters: q.fearGreedLabel
          ? `It classifies as “${q.fearGreedLabel}” — extremes often thin out caution.`
          : 'Extreme sentiment often coincides with thinner caution or forced selling.',
        whatToDo:
          v >= 65
            ? 'Demand stronger confirmation from the Solana sample before adding risk into optimism.'
            : 'Do not invent a bottom. Wait for sample breadth or flow to stabilize first.',
        confidencePct: confidenceFromMacro(q),
        evidence: {
          metrics: [
            { label: 'Fear & Greed', value: String(Math.round(v)) },
            q.fearGreedLabel ? { label: 'Classification', value: q.fearGreedLabel } : null,
          ].filter(Boolean) as Array<{ label: string; value: string }>,
          movers: [],
          spark: [v],
          unavailableReason: null,
        },
      })
    }
  }

  const capped = decisions.slice(0, 3)

  let executiveConclusion: string
  let executiveWhy: string
  let openingLine: string

  if (capped.length === 0 && !rows.length) {
    openingLine = "I've checked the market routes."
    executiveConclusion = UNAVAILABLE
    executiveWhy = 'Macro may be thin and the Solana sample is empty.'
  } else if (quiet) {
    openingLine = "I've finished analyzing today's market."
    executiveConclusion = 'Most of today’s movement is noise.'
    executiveWhy =
      capped.length <= 1
        ? 'Only the quiet itself cleared my filter — nothing else deserves your attention.'
        : `Only ${capped.length} developments deserve your attention.`
  } else if (aChg != null && aChg > 2) {
    openingLine = "I've finished analyzing today's market."
    executiveConclusion = 'The Solana tape is strengthening.'
    executiveWhy =
      capped.length === 1
        ? 'Only one development cleared my filter.'
        : `Only ${capped.length} developments deserve your attention.`
  } else if (aChg != null && aChg < -2) {
    openingLine = "I've finished analyzing today's market."
    executiveConclusion = 'The Solana tape turned defensive.'
    executiveWhy =
      capped.length === 1
        ? 'Only one development cleared my filter.'
        : `Only ${capped.length} developments deserve your attention.`
  } else if (capped.length > 0) {
    openingLine = "I've finished analyzing today's market."
    executiveConclusion = 'The market is rotational — not a blanket call.'
    executiveWhy = `Only ${capped.length} developments deserve your attention.`
  } else {
    openingLine = "I've finished analyzing today's market."
    executiveConclusion = 'No significant market change cleared my filter.'
    executiveWhy = 'Quiet is an honest result when the sample does not move enough to act on.'
  }

  if (!quiet && capped.length === 0 && rows.length > 0) {
    capped.push({
      id: 'tape',
      focus: 'monitoring a mixed sample',
      whatHappened: 'The live sample moved, but not enough to force a directional call.',
      whyItMatters:
        'Mixed prints without aggregate significance usually mean rotation — not a regime shift.',
      whatToDo: 'Stay with monitoring. Do not invent urgency from a flat aggregate.',
      confidencePct: Math.min(baseConf, 55),
      evidence: evidenceFromRows(rows),
    })
  }

  const finalDecisions = capped.slice(0, 3)

  return {
    reconstruction,
    openingLine,
    executiveConclusion,
    executiveWhy,
    temperature,
    temperatureLine: temperatureSpeech(temperature),
    quiet,
    decisions: finalDecisions,
    convictionLine: buildConviction(finalDecisions, quiet),
    sampleSpark: chgs.slice(0, 16),
    sourcesNote,
    unavailableReason: !rows.length && !q ? UNAVAILABLE : null,
    fetchedHint: input.source ?? null,
  }
}

export function isMarketAnalystUnavailable(brief: MarketAnalystBrief): boolean {
  return Boolean(brief.unavailableReason) && brief.decisions.length === 0
}

/** Hold time for speech absorption (same spirit as Mission Control). */
export function marketSpeechHoldMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.min(5200, Math.max(2200, 1400 + words * 85))
}
