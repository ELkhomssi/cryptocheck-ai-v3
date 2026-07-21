'use client'

/**
 * AI Intelligence Workstation — PART IV UI + PART II engines.
 * Hero / Action Queue / Nudges come from resolveIntelligence (derived scores).
 */

import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ShieldCheck, Sparkles } from 'lucide-react'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import { resolveIntelligence } from '@/lib/trading-terminal/engines/resolve-intelligence'
import { computePortfolioImpact } from '@/lib/trading-terminal/portfolio-impact'
import { scanToVerdictCard } from '@/lib/trading-terminal/map-verdict'
import { COMPLIANCE_DISCLAIMER } from '@/lib/trading-terminal/constants'
import { useTerminalPortfolio } from './MiniPortfolioCard'
import { ExecutionTicket } from './ExecutionTicket'
import { useTerminalFocus } from './TerminalFocusProvider'

const VERDICT_COLOR: Record<string, string> = {
  SAFE: 'var(--tit-safe)',
  CAUTION: 'var(--tit-caution)',
  DANGER: 'var(--tit-danger)',
  BLOCKED: 'var(--tit-blocked)',
  HIGH_RISK: 'var(--tit-danger)',
}

function actionTone(type: string): string {
  if (type === 'BUY' || type === 'ADD') return 'text-[var(--tit-pos)]'
  if (type === 'EXIT' || type === 'REDUCE') return 'text-[var(--tit-neg)]'
  if (type === 'MONITOR') return 'text-[var(--tit-warn)]'
  return 'text-[var(--tit-text-1)]'
}

function riskBarColor(level: string): string {
  if (level === 'HIGH' || level === 'CRITICAL') return 'var(--tit-neg)'
  if (level === 'MEDIUM' || level === 'MED') return 'var(--tit-warn)'
  return 'var(--tit-pos)'
}

function riskWidth(level: string): string {
  if (level === 'HIGH' || level === 'CRITICAL') return '85%'
  if (level === 'MEDIUM' || level === 'MED') return '55%'
  return '28%'
}

function relativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export function AiIntelligenceWorkstation() {
  const {
    dataMode,
    scan,
    focusMint,
    focusSymbol,
    selectMint,
    portfolioTotalUsd,
    positionValueUsd,
    ticketAmountSol,
    solPriceUsd,
    setTicketSide,
  } = useTerminalFocus()
  const { data: portfolioData, brain: liveBrain } = useTerminalPortfolio()
  const [reviewOpen, setReviewOpen] = useState(false)

  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])
  const demo = snap.coach.status === 'ready' ? snap.coach.data : null
  const card = scanToVerdictCard(scan)

  const intel = useMemo(
    () =>
      resolveIntelligence({
        mode: dataMode,
        portfolioSummary: portfolioData?.summary ?? null,
        focusMint,
      }),
    [dataMode, portfolioData?.summary, focusMint],
  )

  const hero = intel.hero
  const headline = hero
    ? `BUY ${hero.symbol}`
    : demo?.recommended?.headline ??
      (card
        ? `${
            card.verdict === 'SAFE'
              ? 'BUY'
              : card.verdict === 'HIGH_RISK' || card.verdict === 'BLOCKED'
                ? 'AVOID'
                : 'REVIEW'
          } ${focusSymbol || '—'}`
        : dataMode === 'live'
          ? 'Select a chart symbol'
          : '—')

  const verdict =
    demo?.recommended?.verdict ??
    (card?.verdict === 'HIGH_RISK'
      ? 'DANGER'
      : card?.verdict === 'INSUFFICIENT_DATA'
        ? null
        : card?.verdict) ??
    (hero ? (hero.riskLevel === 'HIGH' ? 'CAUTION' : 'SAFE') : null)

  const conviction = hero?.convictionScore ?? demo?.recommended?.convictionScore ?? null
  const confidence = hero?.confidencePct ?? demo?.recommended?.confidencePct ?? null
  const coverage =
    hero != null
      ? hero.confidencePct // coverage tracks input coverage in engine
      : demo?.recommended?.evidenceCoveragePct ?? null
  const riskScore =
    hero?.measuredInputs.riskScore ?? demo?.recommended?.riskScore ?? card?.riskScore ?? null

  const why = useMemo(() => {
    if (hero?.reasons?.length) {
      return hero.reasons.slice(0, 4).map((w) => ({
        text: w.text,
        ok: w.direction === 'up',
      }))
    }
    if (demo?.why?.length) {
      return demo.why.slice(0, 4).map((w) => ({ text: w.text, ok: w.direction === 'up' }))
    }
    if (card) {
      return [
        ...card.why.map((w) => ({ text: w.text, ok: true })),
        ...card.risks.map((w) => ({ text: w.text, ok: false })),
      ].slice(0, 4)
    }
    return [] as Array<{ text: string; ok: boolean }>
  }, [hero, demo, card])

  const actionQueue = intel.actions.length
    ? intel.actions
    : (liveBrain?.actionQueue ?? []).map((a) => ({
        type: a.type,
        symbol: a.symbol,
        mint: a.mint,
        reason: a.reason,
        priority: a.priority,
        expectedImpact: '',
        confidence: 70,
        sourceEngine: 'portfolio-brain' as const,
      }))

  const positionNow =
    dataMode === 'demo' && snap.positions.status === 'ready'
      ? snap.positions.data.find((p) => p.mint === (hero?.mint || focusMint))?.valueUsd ?? 0
      : positionValueUsd(hero?.mint || focusMint) ?? 0

  const book =
    dataMode === 'demo' && snap.portions.status === 'ready'
      ? snap.portions.data.totalUsd
      : portfolioTotalUsd

  const ticketUsd =
    solPriceUsd != null && ticketAmountSol > 0
      ? ticketAmountSol * solPriceUsd
      : dataMode === 'demo' && snap.solPriceUsd
        ? ticketAmountSol * snap.solPriceUsd
        : null

  const impact = useMemo(
    () =>
      computePortfolioImpact({
        portfolioTotalUsd: book,
        currentPositionUsd: positionNow,
        ticketUsd,
        side: 'buy',
      }),
    [book, positionNow, ticketUsd],
  )

  const riskAnalysis =
    demo?.riskAnalysis ??
    (intel.brain
      ? {
          concentration:
            intel.brain.riskExposure.band === 'CRITICAL' ||
            intel.brain.riskExposure.band === 'HIGH'
              ? ('HIGH' as const)
              : intel.brain.riskExposure.band === 'MEDIUM'
                ? ('MEDIUM' as const)
                : ('LOW' as const),
          liquidity: intel.brain.threats.length > 0 ? ('HIGH' as const) : ('LOW' as const),
          correlation: 'MEDIUM' as const,
          volatility: 'MEDIUM' as const,
          smartMoney: 'LOW' as const,
        }
      : null)

  const alerts =
    dataMode === 'demo' && snap.intel.status === 'ready' ? snap.intel.data.slice(0, 4) : []

  const nudges = intel.nudges

  const onReview = () => {
    const mint = hero?.mint || demo?.recommended?.mint || focusMint
    const sym = hero?.symbol || demo?.recommended?.symbol || focusSymbol
    if (mint) selectMint(mint, sym)
    setTicketSide('buy')
    setReviewOpen(true)
  }

  const onQueueClick = (mint: string, symbol: string, type: string) => {
    selectMint(mint, symbol)
    if (type === 'BUY' || type === 'ADD') setTicketSide('buy')
    if (type === 'EXIT' || type === 'REDUCE') setTicketSide('sell')
  }

  if (reviewOpen) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--tit-bg-0)]">
        <div className="flex items-center justify-between border-b border-[var(--tit-border)] px-3 py-2">
          <p className="tit-label">Review trade</p>
          <button
            type="button"
            onClick={() => setReviewOpen(false)}
            className="tit-mono text-[0.6rem] text-[var(--tit-text-1)] underline"
          >
            Back to intelligence
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ExecutionTicket />
        </div>
      </div>
    )
  }

  const before = impact.beforePct
  const after = impact.afterPct

  return (
    <aside
      className="flex h-full min-h-0 flex-col overflow-hidden border-l border-[var(--tit-border)] bg-[var(--tit-bg-0)]"
      aria-label="AI Intelligence Workstation"
    >
      <div className="tit-scroll min-h-0 flex-1 overflow-y-auto">
        {/* PROMPT 21 — proactive nudges */}
        {nudges.length > 0 ? (
          <section className="space-y-1 border-b border-[var(--tit-border)] px-3 py-2">
            <p className="tit-label mb-1">Coach Watching Your Book</p>
            {nudges.slice(0, 2).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onQueueClick(n.mint, n.symbol, n.suggestedAction)}
                className={`flex w-full items-start gap-2 rounded border px-2 py-1.5 text-left ${
                  n.kind === 'defense'
                    ? 'border-[var(--tit-warn)]/40 bg-[var(--tit-warn)]/8'
                    : 'border-[var(--tit-pos)]/35 bg-[var(--tit-pos)]/8'
                }`}
              >
                {n.kind === 'defense' ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tit-warn)]" />
                ) : (
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tit-pos)]" />
                )}
                <span className="min-w-0">
                  <span className="block text-[0.68rem] leading-snug text-[var(--tit-text-0)]">
                    {n.message}
                  </span>
                  <span className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">
                    conf {n.confidencePct}% · {n.suggestedAction} · NFA
                  </span>
                </span>
              </button>
            ))}
          </section>
        ) : null}

        <section className="border-b border-[var(--tit-border)] px-3 py-3.5">
          <p className="tit-label mb-2">AI Conviction</p>
          <h2 className="text-[1.65rem] font-bold leading-none tracking-tight text-[var(--tit-text-0)]">
            {headline}
          </h2>
          {verdict ? (
            <span
              className="mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase"
              style={{
                color: VERDICT_COLOR[verdict] ?? 'var(--tit-text-1)',
                background: `color-mix(in srgb, ${VERDICT_COLOR[verdict] ?? '#888'} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${VERDICT_COLOR[verdict] ?? '#888'} 35%, transparent)`,
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {verdict}
            </span>
          ) : null}
          <p className="tit-mono mt-2.5 text-[0.7rem] text-[var(--tit-text-1)]">
            Conviction{' '}
            <span className="font-bold text-[var(--tit-text-0)]">{conviction ?? '—'}</span>
            {' · '}
            Confidence{' '}
            <span className="font-bold text-[var(--tit-text-0)]">
              {confidence != null ? `${confidence}%` : '—'}
            </span>
            {' · '}
            Coverage{' '}
            <span className="font-bold text-[var(--tit-text-0)]">
              {coverage != null ? `${coverage}%` : '—'}
            </span>
          </p>
          {riskScore != null ? (
            <p className="tit-mono mt-1 text-[0.55rem] text-[var(--tit-text-2)]">
              Risk {riskScore}/100 · {intel.methodNote}
            </p>
          ) : (
            <p className="tit-mono mt-1 text-[0.55rem] text-[var(--tit-text-2)]">{intel.methodNote}</p>
          )}

          <p className="tit-label mb-1.5 mt-3">Why Now</p>
          {why.length === 0 ? (
            <p className="text-[0.7rem] text-[var(--tit-text-1)]">
              {dataMode === 'live' ? 'Insufficient evidence to attribute.' : '—'}
            </p>
          ) : (
            <ul className="space-y-1">
              {why.map((w) => (
                <li key={w.text} className="flex items-start gap-1.5 text-[0.72rem] leading-snug">
                  <Check
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      w.ok ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-warn)]'
                    }`}
                  />
                  <span className="text-[var(--tit-text-0)]">{w.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-b border-[var(--tit-border)] px-3 py-3">
          <p className="tit-label mb-2">AI Action Queue</p>
          {actionQueue.length === 0 ? (
            <p className="text-[0.7rem] text-[var(--tit-text-1)]">
              No priority actions — book is balanced.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {actionQueue.slice(0, 4).map((a, i) => (
                <li key={`${a.type}-${a.mint}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onQueueClick(a.mint, a.symbol, a.type)}
                    className="flex w-full items-start gap-2.5 rounded border border-[var(--tit-border)] bg-[var(--tit-bg-1)] px-2.5 py-2 text-left transition-colors duration-[var(--tit-motion)] hover:bg-[var(--tit-bg-2)]"
                  >
                    <span className="tit-mono text-[0.75rem] font-bold text-[var(--tit-text-2)]">
                      #{i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`tit-mono text-[0.8rem] font-bold ${actionTone(a.type)}`}>
                        {a.type} {a.symbol}
                      </span>
                      <span className="mt-0.5 block text-[0.62rem] leading-snug text-[var(--tit-text-1)]">
                        {a.reason}
                      </span>
                      {'sourceEngine' in a && a.sourceEngine ? (
                        <span className="tit-mono text-[0.45rem] text-[var(--tit-text-2)]">
                          {a.sourceEngine}
                          {'confidence' in a && a.confidence != null
                            ? ` · conf ${a.confidence}%`
                            : ''}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="border-b border-[var(--tit-border)] px-3 py-3">
          <p className="tit-label mb-2">Portfolio Impact</p>
          <div className="space-y-2">
            <ImpactBar label="Current exposure" pct={before} />
            <ImpactBar label="After trade" pct={after} accent />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`tit-mono rounded px-1.5 py-0.5 text-[0.6rem] font-bold ${
                impact.riskLevel === 'HIGH'
                  ? 'bg-[var(--tit-neg)]/15 text-[var(--tit-neg)]'
                  : impact.riskLevel === 'MEDIUM'
                    ? 'bg-[var(--tit-warn)]/15 text-[var(--tit-warn)]'
                    : 'bg-[var(--tit-pos)]/15 text-[var(--tit-pos)]'
              }`}
            >
              Risk {impact.riskLevel ?? demo?.tradePlan.riskLevel ?? '—'}
            </span>
            {before != null && after != null ? (
              <span className="tit-mono text-[0.6rem] text-[var(--tit-text-2)]">
                Concentration {after - before >= 0 ? '+' : ''}
                {(after - before).toFixed(1)}%
              </span>
            ) : null}
          </div>
        </section>

        <section className="border-b border-[var(--tit-border)] px-3 py-3">
          <p className="tit-label mb-2">Risk Exposure</p>
          {!riskAnalysis ? (
            <p className="text-[0.65rem] text-[var(--tit-text-1)]">
              {dataMode === 'live' ? 'Connect wallet for risk gauges.' : '—'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {(
                [
                  ['Concentration', riskAnalysis.concentration],
                  ['Liquidity', riskAnalysis.liquidity],
                  ['Correlation', riskAnalysis.correlation],
                  ['Volatility', riskAnalysis.volatility],
                ] as const
              ).map(([label, level]) => (
                <li key={label}>
                  <div className="mb-0.5 flex justify-between text-[0.55rem]">
                    <span className="text-[var(--tit-text-1)]">{label}</span>
                    <span className="tit-mono font-bold" style={{ color: riskBarColor(level) }}>
                      {level}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded bg-[var(--tit-bg-3)]">
                    <div
                      className="h-full rounded"
                      style={{ width: riskWidth(level), background: riskBarColor(level) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="px-3 py-3">
          <p className="tit-label mb-2">Recent Intelligence</p>
          {alerts.length === 0 ? (
            <p className="text-[0.65rem] text-[var(--tit-text-1)]">
              {dataMode === 'live' ? 'Awaiting on-chain intel.' : '—'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {alerts.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => a.mint && a.symbol && selectMint(a.mint, a.symbol)}
                  >
                    <span className="block text-[0.65rem] font-medium text-[var(--tit-text-0)]">
                      {a.headline}
                    </span>
                    <span className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">
                      {relativeTime(a.at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="shrink-0 border-t border-[var(--tit-border)] p-3">
        <button
          type="button"
          onClick={onReview}
          className="tit-btn-accent w-full py-2.5 text-[0.8rem] font-bold"
        >
          REVIEW TRADE →
        </button>
        <p className="tit-compliance mt-2 text-center text-[0.5rem]">{COMPLIANCE_DISCLAIMER}</p>
      </div>
    </aside>
  )
}

function ImpactBar({
  label,
  pct,
  accent,
}: {
  label: string
  pct: number | null
  accent?: boolean
}) {
  const w = pct == null ? 0 : Math.min(100, Math.max(0, pct))
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[0.55rem]">
        <span className="text-[var(--tit-text-1)]">{label}</span>
        <span className="tit-mono font-semibold text-[var(--tit-text-0)]">
          {pct != null ? `${pct.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-[var(--tit-bg-3)]">
        <div
          className="h-full rounded transition-[width] duration-[var(--tit-motion)]"
          style={{
            width: `${w}%`,
            background: accent ? 'var(--tit-accent)' : 'var(--tit-text-2)',
          }}
        />
      </div>
    </div>
  )
}
