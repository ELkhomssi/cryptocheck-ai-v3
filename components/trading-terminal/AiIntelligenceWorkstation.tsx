'use client'

/**
 * PART IV — AI Intelligence Workstation (PROMPT 24).
 * Hero conviction dominates. Action queue large. Portfolio impact with bars.
 * Risk + alerts folded in. Execution last.
 */

import { useMemo, useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
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
  const { brain: liveBrain } = useTerminalPortfolio()
  const [reviewOpen, setReviewOpen] = useState(false)

  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])
  const demo = snap.coach.status === 'ready' ? snap.coach.data : null
  const card = scanToVerdictCard(scan)

  const recommended = demo?.recommended ?? null
  const headline = recommended
    ? recommended.headline
    : card
      ? `${
          card.verdict === 'SAFE'
            ? 'BUY'
            : card.verdict === 'HIGH_RISK' || card.verdict === 'BLOCKED'
              ? 'AVOID'
              : 'REVIEW'
        } ${focusSymbol || '—'}`
      : dataMode === 'live'
        ? 'Select a chart symbol'
        : '—'

  const verdict =
    recommended?.verdict ??
    (card?.verdict === 'HIGH_RISK'
      ? 'DANGER'
      : card?.verdict === 'INSUFFICIENT_DATA'
        ? null
        : card?.verdict) ??
    null

  const conviction =
    recommended?.convictionScore ??
    (demo?.opportunities?.[0]?.conviction ?? null)
  const confidence = recommended?.confidencePct ?? null
  const coverage = recommended?.evidenceCoveragePct ?? null
  const riskScore = recommended?.riskScore ?? card?.riskScore ?? null

  const why = useMemo(() => {
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
  }, [demo, card])

  const actionQueue = demo?.actionQueue?.length
    ? demo.actionQueue
    : liveBrain?.actionQueue?.map((a) => ({
        type: a.type,
        symbol: a.symbol,
        reason: a.reason,
        priority: a.priority,
        mint: a.mint,
      })) ?? []

  const positionNow =
    dataMode === 'demo' && snap.positions.status === 'ready'
      ? snap.positions.data.find((p) => p.mint === (recommended?.mint || focusMint))?.valueUsd ?? 0
      : positionValueUsd(recommended?.mint || focusMint) ?? 0

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
        side: recommended?.side === 'SELL' || recommended?.side === 'REDUCE' ? 'sell' : 'buy',
      }),
    [book, positionNow, ticketUsd, recommended?.side],
  )

  const riskAnalysis =
    demo?.riskAnalysis ??
    (liveBrain
      ? {
          concentration:
            liveBrain.riskExposure.band === 'CRITICAL' || liveBrain.riskExposure.band === 'HIGH'
              ? ('HIGH' as const)
              : liveBrain.riskExposure.band === 'MEDIUM'
                ? ('MEDIUM' as const)
                : ('LOW' as const),
          liquidity: liveBrain.threats.length > 0 ? ('HIGH' as const) : ('LOW' as const),
          correlation: 'MEDIUM' as const,
          volatility: 'MEDIUM' as const,
          smartMoney: 'LOW' as const,
        }
      : null)

  const alerts =
    dataMode === 'demo' && snap.intel.status === 'ready' ? snap.intel.data.slice(0, 4) : []

  const onReview = () => {
    const mint = recommended?.mint || focusMint
    const sym = recommended?.symbol || focusSymbol
    if (mint) selectMint(mint, sym)
    if (recommended?.side === 'SELL' || recommended?.side === 'REDUCE') setTicketSide('sell')
    else setTicketSide('buy')
    setReviewOpen(true)
  }

  const onQueueClick = (symbol: string, type: string) => {
    const fromOpp =
      snap.discover.status === 'ready'
        ? snap.discover.data.find((d) => d.symbol === symbol)
        : null
    if (fromOpp) selectMint(fromOpp.mint, fromOpp.symbol)
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
        {/* HERO — PROMPT 24 */}
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
            {conviction != null ? (
              <>
                Conviction{' '}
                <span className="font-bold text-[var(--tit-text-0)]">{conviction}</span>
              </>
            ) : (
              <span>Conviction —</span>
            )}
            {' · '}
            {confidence != null ? (
              <>
                Confidence{' '}
                <span className="font-bold text-[var(--tit-text-0)]">{confidence}%</span>
              </>
            ) : (
              'Confidence —'
            )}
            {' · '}
            {coverage != null ? (
              <>
                Coverage{' '}
                <span className="font-bold text-[var(--tit-text-0)]">{coverage}%</span>
              </>
            ) : (
              'Coverage —'
            )}
          </p>
          {riskScore != null ? (
            <p className="tit-mono mt-1 text-[0.6rem] text-[var(--tit-text-2)]">
              Risk score {riskScore}/100
              {dataMode === 'demo' ? ' · DEMO_SEED derived' : ''}
            </p>
          ) : null}

          <p className="tit-label mb-1.5 mt-3">Why Now</p>
          {why.length === 0 ? (
            <p className="text-[0.7rem] text-[var(--tit-text-1)]">
              {dataMode === 'live' ? 'Select a symbol to load evidence.' : '—'}
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

        {/* ACTION QUEUE — large */}
        <section className="border-b border-[var(--tit-border)] px-3 py-3">
          <p className="tit-label mb-2">AI Action Queue</p>
          {actionQueue.length === 0 ? (
            <p className="text-[0.7rem] text-[var(--tit-text-1)]">No priority actions — book is balanced.</p>
          ) : (
            <ol className="space-y-1.5">
              {actionQueue.slice(0, 4).map((a, i) => (
                <li key={`${a.type}-${a.symbol}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onQueueClick(a.symbol, a.type)}
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
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* PORTFOLIO IMPACT — before/after bars */}
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
          {book > 0 && dataMode === 'demo' && snap.portions.status === 'ready' ? (
            <p className="tit-mono mt-2 text-[0.65rem] text-[var(--tit-text-0)]">
              Book ${book.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span
                className={
                  snap.portions.data.pnl24hPct >= 0
                    ? ' text-[var(--tit-pos)]'
                    : ' text-[var(--tit-neg)]'
                }
              >
                {' '}
                · {snap.portions.data.pnl24hPct >= 0 ? '+' : ''}
                {snap.portions.data.pnl24hPct.toFixed(2)}%
              </span>
            </p>
          ) : null}
        </section>

        {/* RISK — folded from bottom panel */}
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

        {/* ALERTS — folded */}
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
