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

/** One decision the analyst elevates — answers What / Why / Do. */
export type MarketDecision = {
  id: string
  whatHappened: string
  whyItMatters: string
  whatToDo: string
  evidence: MarketEvidence
}

export type MarketAnalystBrief = {
  reconstruction: MarketProcessStep[]
  /** Single executive line — the OS already finished reading. */
  executiveConclusion: string
  /** One sentence under the conclusion. */
  executiveWhy: string
  /** Quiet tape — honest when nothing significant. */
  quiet: boolean
  /** At most three decisions. */
  decisions: MarketDecision[]
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
      label: 'Solana screener corpus',
      status: loading
        ? 'Reading…'
        : rows.length > 0
          ? `${rows.length} tokens loaded${source ? ` · ${source}` : ''}.`
          : 'Empty sample.',
      done: !loading,
    },
    {
      id: 'flow',
      label: 'Order flow & smart money',
      status: loading
        ? 'Reading…'
        : rows.some((r) => r.buySellRatio > 0 || r.smartMoneyScore > 0)
          ? 'Scores present in sample.'
          : 'Sparse flow fields.',
      done: !loading,
    },
    {
      id: 'macro',
      label: 'Macro quotes',
      status: loading
        ? 'Reading…'
        : q && (q.btcChangePct != null || q.fearGreed != null)
          ? 'BTC / SOL / Fear&Greed available.'
          : 'Macro incomplete.',
      done: !loading,
    },
    {
      id: 'filter',
      label: 'Significance filter',
      status: loading ? 'Filtering…' : 'Keeping only moves that deserve attention.',
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
 * Build ≤3 decisions from live engines. Quiet tape → say so. Never invent.
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
    return {
      reconstruction,
      executiveConclusion: 'Reading the live market.',
      executiveWhy: 'Screener and macro routes first — no decision until the sample lands.',
      quiet: false,
      decisions: [],
      sampleSpark: [],
      sourcesNote,
      unavailableReason: null,
      fetchedHint: input.source ?? null,
    }
  }

  if (!rows.length && !q) {
    return {
      reconstruction,
      executiveConclusion: UNAVAILABLE,
      executiveWhy: 'Existing market routes returned nothing usable.',
      quiet: true,
      decisions: [],
      sampleSpark: [],
      sourcesNote,
      unavailableReason: UNAVAILABLE,
      fetchedHint: input.source ?? null,
    }
  }

  const chgs = rows.map((r) => r.change24hPct).filter((n) => Number.isFinite(n))
  const aChg = avg(chgs)
  const buys = rows.map((r) => r.buySellRatio).filter((n) => n > 0)
  const aBuy = avg(buys)
  const smart = rows.map((r) => r.smartMoneyScore).filter((n) => Number.isFinite(n))
  const aSmart = avg(smart)
  const top = [...rows].sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))[0]

  const tapeSignificant = aChg != null && Math.abs(aChg) >= 2
  const flowSignificant = aBuy != null && (aBuy >= 1.12 || aBuy < 0.88)
  const macroSignificant =
    (q?.btcChangePct != null && Math.abs(q.btcChangePct) >= 1.5) ||
    (q?.fearGreed != null && (q.fearGreed >= 65 || q.fearGreed <= 30)) ||
    (q?.marketCapChangePct != null && Math.abs(q.marketCapChangePct) >= 1.5)

  const quiet =
    rows.length > 0 &&
    !tapeSignificant &&
    !flowSignificant &&
    !macroSignificant

  const decisions: MarketDecision[] = []

  // Decision 1 — tape (only if significant or we need an honest quiet call)
  if (rows.length > 0) {
    if (quiet || !tapeSignificant) {
      if (quiet) {
        decisions.push({
          id: 'tape',
          whatHappened:
            'No significant market change in the live Solana sample — the tape is relatively quiet.',
          whyItMatters:
            'Quiet sessions are information: chasing noise usually costs more than waiting for a real imprint.',
          whatToDo:
            'Do not force a trade narrative. Keep monitoring; revisit when breadth or flow breaks the quiet band.',
          evidence: evidenceFromRows(rows),
        })
      }
    } else if (aChg != null && aChg > 2) {
      decisions.push({
        id: 'tape',
        whatHappened: 'Solana sample breadth strengthened — advances outweigh declines.',
        whyItMatters:
          top?.symbol != null
            ? `Largest absolute move sits with ${top.symbol} (${fmtPct(top.change24hPct)}) — that is where attention concentrates.`
            : 'Positive aggregate 24h change is visible in the live screener sample.',
        whatToDo:
          'Prioritize confirmation from volume leaders before treating strength as durable. Inspect the leading names; do not extrapolate from a single print.',
        evidence: evidenceFromRows(rows),
      })
    } else if (aChg != null && aChg < -2) {
      decisions.push({
        id: 'tape',
        whatHappened: 'Solana sample turned defensive — declines outweigh advances.',
        whyItMatters:
          top?.symbol != null
            ? `Pressure is loudest in ${top.symbol} (${fmtPct(top.change24hPct)}).`
            : 'Negative aggregate 24h change is visible in the live screener sample.',
        whatToDo:
          'Treat bounces as suspect until sell pressure cools in the sample. Review liquidity exits before adding risk.',
        evidence: evidenceFromRows(rows),
      })
    }
  }

  // Decision 2 — flow (only if significant)
  if (flowSignificant && aBuy != null && decisions.length < 3) {
    if (aBuy >= 1.12 && (aSmart == null || aSmart < 55)) {
      decisions.push({
        id: 'flow',
        whatHappened:
          'Buying pressure rose in the live sample, without a strong smart-money stamp.',
        whyItMatters:
          'Elevated buy/sell with moderate smart-money scores often means newer flow — attention without institutional confirmation.',
        whatToDo:
          'Size cautiously. Prefer names where volume and liquidity both confirm; avoid chasing pure ratio spikes.',
        evidence: evidenceFromRows(rows),
      })
    } else if (aBuy >= 1.12 && aSmart != null && aSmart >= 55) {
      decisions.push({
        id: 'flow',
        whatHappened:
          'Buying pressure rose alongside elevated smart-money scores in the sample.',
        whyItMatters:
          'When both flow and smart-money lean the same way, the move is more structured than retail chase alone.',
        whatToDo:
          'Focus review on high smart-money names in the sample. Still simulate risk before any size.',
        evidence: evidenceFromRows(rows),
      })
    } else if (aBuy < 0.88) {
      decisions.push({
        id: 'flow',
        whatHappened: 'Sell-side pressure is more visible than demand in today’s sample.',
        whyItMatters: `Average buy/sell ratio sits at ${aBuy.toFixed(2)} — below parity across measured tokens.`,
        whatToDo:
          'Do not lean into weakness without a clear liquidity reclaim. Wait for ratio normalization in the sample.',
        evidence: evidenceFromRows(rows),
      })
    }
  }

  // Decision 3 — macro (only if significant)
  if (macroSignificant && q && decisions.length < 3) {
    if (q.btcChangePct != null && Math.abs(q.btcChangePct) >= 1.5) {
      const btc = q.btcChangePct
      const sol = q.solChangePct
      let what: string
      let why: string
      let action: string
      if (btc > 1.5 && (sol == null || sol < btc - 0.5)) {
        what = 'Bitcoin is absorbing relative strength versus Solana in today’s quotes.'
        why = 'When BTC leads and SOL lags, alt liquidity often rotates up the risk curve — or stalls.'
        action =
          'Assume Solana beta may lag until relative strength reappears. Do not invent a Solana breakout from BTC alone.'
      } else if (sol != null && sol > btc + 1) {
        what = 'Solana is outperforming Bitcoin on the day in the quote set.'
        why = 'Relative SOL strength means today’s Solana tape is not just a BTC shadow.'
        action =
          'Judge Solana names on their own sample — BTC is not the whole story in this window.'
      } else if (btc < -1.5) {
        what = 'Bitcoin softens in the macro quote set — risk appetite is under pressure.'
        why =
          sol != null
            ? `SOL 24h is ${fmtPct(sol)} beside BTC ${fmtPct(btc)}.`
            : `BTC 24h is ${fmtPct(btc)}; SOL change was not returned.`
        action =
          'Raise the bar for new risk until BTC stabilizes or Solana clearly decouples in the sample.'
      } else {
        what = 'Bitcoin’s day move is material, but it is not cleanly dominating Solana.'
        why = 'Relative BTC/SOL prints are mixed — treat chain-specific sample as primary.'
        action = 'Stay with Solana sample leaders; do not force a BTC-led narrative.'
      }
      const metrics: MarketEvidence['metrics'] = [
        { label: 'BTC 24h', value: fmtPct(btc) },
      ]
      if (sol != null) metrics.push({ label: 'SOL 24h', value: fmtPct(sol) })
      if (q.fearGreed != null) metrics.push({ label: 'Fear & Greed', value: String(Math.round(q.fearGreed)) })
      decisions.push({
        id: 'macro',
        whatHappened: what,
        whyItMatters: why,
        whatToDo: action,
        evidence: {
          metrics,
          movers: [],
          spark: [btc, sol ?? 0].filter((n) => Number.isFinite(n)),
          unavailableReason: null,
        },
      })
    } else if (q.fearGreed != null && (q.fearGreed >= 65 || q.fearGreed <= 30)) {
      const v = q.fearGreed
      decisions.push({
        id: 'sentiment',
        whatHappened:
          v >= 65
            ? 'Sentiment print is stretched toward greed.'
            : 'Sentiment print is stretched toward fear.',
        whyItMatters: q.fearGreedLabel
          ? `Fear & Greed classifies this as “${q.fearGreedLabel}”.`
          : 'Extreme sentiment often coincides with thinner caution or forced selling.',
        whatToDo:
          v >= 65
            ? 'Demand stronger confirmation from the Solana sample before adding risk into optimism.'
            : 'Do not invent a bottom. Wait for sample breadth or flow to stabilize first.',
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

  // Cap at 3
  const capped = decisions.slice(0, 3)

  let executiveConclusion: string
  let executiveWhy: string
  if (capped.length === 0 && !rows.length) {
    executiveConclusion = UNAVAILABLE
    executiveWhy = 'Macro may be thin and the Solana sample is empty.'
  } else if (quiet) {
    executiveConclusion = 'The market is quiet. Nothing significant requires your attention.'
    executiveWhy =
      'I filtered the live sample — breadth, flow, and macro all sit inside a quiet band.'
  } else if (aChg != null && aChg > 2) {
    executiveConclusion = 'The market is strengthening.'
    executiveWhy =
      'I already filtered the live sample. Three decisions follow — only what deserves attention.'
  } else if (aChg != null && aChg < -2) {
    executiveConclusion = 'The market turned defensive.'
    executiveWhy =
      'I already filtered the live sample. Three decisions follow — only what deserves attention.'
  } else if (capped.length > 0) {
    executiveConclusion = 'The market is rotational — a few prints deserve attention, not a blanket call.'
    executiveWhy = 'Breadth is muted; the decisions below are the only ones that cleared the filter.'
  } else {
    executiveConclusion = 'No significant market change cleared the filter.'
    executiveWhy = 'Quiet is an honest result when the sample does not move enough to act on.'
  }

  // If we have significant decisions but quiet was false and tape didn't add, ensure we still have content
  if (!quiet && capped.length === 0 && rows.length > 0) {
    capped.push({
      id: 'tape',
      whatHappened: 'The live sample moved, but not enough to force a directional call.',
      whyItMatters: 'Mixed prints without aggregate significance usually mean rotation, not a regime shift.',
      whatToDo: 'Stay with monitoring. Do not invent urgency from a flat aggregate.',
      evidence: evidenceFromRows(rows),
    })
  }

  return {
    reconstruction,
    executiveConclusion,
    executiveWhy,
    quiet,
    decisions: capped.slice(0, 3),
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
