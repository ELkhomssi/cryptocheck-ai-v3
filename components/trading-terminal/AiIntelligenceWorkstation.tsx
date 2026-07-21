'use client'

/**
 * AI Intelligence Workstation — the product surface.
 * Charts are context; this column answers: what / why / risk / do next.
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
  return 'text-[var(--tit-info)]'
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
      ? `${card.verdict === 'SAFE' ? 'BUY' : card.verdict === 'DANGER' || card.verdict === 'BLOCKED' ? 'AVOID' : 'REVIEW'} ${focusSymbol || '—'}`
      : dataMode === 'live'
        ? 'Select a chart symbol'
        : '—'

  const verdict = recommended?.verdict ?? (card?.verdict === 'HIGH_RISK' ? 'DANGER' : card?.verdict) ?? null
  const riskScore = recommended?.riskScore ?? card?.riskScore ?? null
  const confidence =
    recommended?.confidencePct ??
    (card
      ? card.confidenceBand === 'high'
        ? 85
        : card.confidenceBand === 'medium'
          ? 62
          : 40
      : null)
  const coverage =
    recommended?.evidenceCoveragePct ??
    (card ? Math.round(card.evidence.coverage * 100) : null)

  const why = useMemo(() => {
    if (demo?.why?.length) {
      return demo.why.slice(0, 5).map((w) => ({ text: w.text, ok: w.direction === 'up' }))
    }
    if (card) {
      const bullets = [
        ...card.why.map((w) => ({ text: w.text, ok: true })),
        ...card.risks.map((w) => ({ text: w.text, ok: false })),
      ]
      return bullets.slice(0, 5)
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
    const fromQueue = actionQueue.find((a) => a.symbol === symbol) as
      | { mint?: string; symbol: string }
      | undefined
    if (fromOpp) selectMint(fromOpp.mint, fromOpp.symbol)
    else if (fromQueue && 'mint' in fromQueue && fromQueue.mint) selectMint(fromQueue.mint, symbol)
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

  return (
    <aside
      className="flex h-full min-h-0 flex-col overflow-hidden border-l border-[var(--tit-border)] bg-[var(--tit-bg-0)]"
      aria-label="AI Intelligence Workstation"
    >
      <div className="tit-scroll min-h-0 flex-1 overflow-y-auto">
        {/* 1 — Recommended Action */}
        <section className="border-b border-[var(--tit-border)] px-3 py-3">
          <p className="tit-label mb-2">Recommended Action</p>
          <div className="flex items-start gap-2.5">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--tit-accent)]/15 tit-mono text-[0.75rem] font-bold text-[var(--tit-accent)]"
              aria-hidden
            >
              {(recommended?.symbol || focusSymbol || 'AI').slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[1.35rem] font-bold leading-tight tracking-tight text-[var(--tit-text-0)]">
                {headline}
              </h2>
              {verdict ? (
                <span
                  className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase"
                  style={{
                    color: VERDICT_COLOR[verdict] ?? 'var(--tit-text-1)',
                    background: `color-mix(in srgb, ${VERDICT_COLOR[verdict] ?? '#888'} 18%, transparent)`,
                  }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {verdict}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Risk Score" value={riskScore != null ? `${riskScore}/100` : '—'} />
            <Metric label="Confidence" value={confidence != null ? `${confidence}%` : '—'} />
            <Metric label="Coverage" value={coverage != null ? `${coverage}%` : '—'} />
          </div>
        </section>

        {/* 2 — Why */}
        <section className="border-b border-[var(--tit-border)] px-3 py-3">
          <p className="tit-label mb-2">Why This Opportunity</p>
          {why.length === 0 ? (
            <p className="text-[0.7rem] text-[var(--tit-text-1)]">Focus a symbol to load evidence.</p>
          ) : (
            <ul className="space-y-1.5">
              {why.map((w) => (
                <li key={w.text} className="flex items-start gap-2 text-[0.72rem] leading-snug">
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

        {/* 3 — Portfolio Impact */}
        <section className="border-b border-[var(--tit-border)] px-3 py-3">
          <p className="tit-label mb-2">Portfolio Impact</p>
          <p className="tit-mono text-[0.85rem] font-semibold text-[var(--tit-text-0)]">
            {impact.beforePct != null ? `${impact.beforePct.toFixed(1)}%` : '—'}
            <span className="mx-1.5 text-[var(--tit-text-2)]">→</span>
            <span className="text-[var(--tit-accent-bright)]">
              {impact.afterPct != null ? `${impact.afterPct.toFixed(1)}%` : '—'}
            </span>
          </p>
          <p className="mt-1 text-[0.6rem] text-[var(--tit-text-2)]">Exposure before → after ticket</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="tit-label !mb-0">Risk Level</span>
            <span
              className={`tit-mono rounded px-1.5 py-0.5 text-[0.65rem] font-bold ${
                impact.riskLevel === 'HIGH'
                  ? 'bg-[var(--tit-neg)]/15 text-[var(--tit-neg)]'
                  : impact.riskLevel === 'MEDIUM'
                    ? 'bg-[var(--tit-warn)]/15 text-[var(--tit-warn)]'
                    : 'bg-[var(--tit-pos)]/15 text-[var(--tit-pos)]'
              }`}
            >
              {impact.riskLevel ?? (demo?.tradePlan.riskLevel || '—')}
            </span>
          </div>
        </section>

        {/* 4 — Action Queue */}
        <section className="px-3 py-3">
          <p className="tit-label mb-2">AI Action Queue</p>
          {actionQueue.length === 0 ? (
            <p className="text-[0.7rem] text-[var(--tit-text-1)]">No priority actions.</p>
          ) : (
            <ol className="space-y-2">
              {actionQueue.slice(0, 4).map((a, i) => (
                <li key={`${a.type}-${a.symbol}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onQueueClick(a.symbol, a.type)}
                    className="flex w-full items-start gap-2 rounded border border-[var(--tit-border)] bg-[var(--tit-bg-1)] px-2 py-1.5 text-left hover:border-[var(--tit-accent)]/40"
                  >
                    <span className="tit-mono text-[0.65rem] font-bold text-[var(--tit-text-2)]">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`tit-mono text-[0.75rem] font-bold ${actionTone(a.type)}`}>
                        {a.type} {a.symbol}
                      </span>
                      <span className="mt-0.5 block text-[0.62rem] text-[var(--tit-text-1)]">
                        {a.reason}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="shrink-0 border-t border-[var(--tit-border)] p-3">
        <button type="button" onClick={onReview} className="tit-btn-accent w-full py-2.5 text-[0.8rem] font-bold">
          REVIEW TRADE →
        </button>
        <p className="tit-compliance mt-2 text-center text-[0.5rem]">{COMPLIANCE_DISCLAIMER}</p>
      </div>
    </aside>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--tit-border)] bg-[var(--tit-bg-1)] px-2 py-1.5">
      <p className="tit-label !text-[8px]">{label}</p>
      <p className="tit-mono text-[0.8rem] font-bold text-[var(--tit-text-0)]">{value}</p>
    </div>
  )
}
