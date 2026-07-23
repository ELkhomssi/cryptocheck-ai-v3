'use client'

/**
 * AI Intelligence Workstation — institutional research desk.
 * Sections: Coach AI · Conviction · Risk · Whale · Smart Money ·
 * Recommendations · Narrative · Execution Queue.
 */

import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Fish,
  Radio,
  ShieldCheck,
  Sparkles,
  Waves,
} from 'lucide-react'
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

function formatFlow(usd: number): string {
  const abs = Math.abs(usd)
  const sign = usd >= 0 ? '+' : '−'
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`
  return `${sign}$${Math.round(abs)}`
}

function SectionHeader({ title, live }: { title: string; live?: boolean }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <p className="tit-section-title">{title}</p>
      {live ? (
        <span className="flex items-center gap-1.5">
          <span className="tit-pulse" />
          <span className="tit-mono text-[0.5rem] uppercase tracking-wider text-[var(--tit-text-2)]">
            Live
          </span>
        </span>
      ) : null}
    </div>
  )
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
      ? hero.confidencePct
      : demo?.recommended?.evidenceCoveragePct ?? null
  const riskScore =
    hero?.measuredInputs.riskScore ?? demo?.recommended?.riskScore ?? card?.riskScore ?? null

  const attribution = intel.attribution
  const measured = hero?.measuredInputs ?? null

  const why = useMemo(() => {
    if (attribution?.shares?.length) {
      return attribution.shares.slice(0, 5).map((s) => ({
        text: `${s.evidence}`,
        label: s.label,
        sharePct: s.sharePct,
        ok: s.direction === 'up',
      }))
    }
    if (hero?.reasons?.length) {
      return hero.reasons.slice(0, 4).map((w) => ({
        text: w.text,
        label: null as string | null,
        sharePct: null as number | null,
        ok: w.direction === 'up',
      }))
    }
    if (demo?.why?.length) {
      return demo.why.slice(0, 4).map((w) => ({
        text: w.text,
        label: null as string | null,
        sharePct: null as number | null,
        ok: w.direction === 'up',
      }))
    }
    if (card) {
      return [
        ...card.why.map((w) => ({
          text: w.text,
          label: null as string | null,
          sharePct: null as number | null,
          ok: true,
        })),
        ...card.risks.map((w) => ({
          text: w.text,
          label: null as string | null,
          sharePct: null as number | null,
          ok: false,
        })),
      ].slice(0, 4)
    }
    return [] as Array<{
      text: string
      label: string | null
      sharePct: number | null
      ok: boolean
    }>
  }, [attribution, hero, demo, card])

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

  const alerts = intel.alerts
  const nudges = intel.nudges
  const whaleAlerts = alerts.filter((a) => {
    const h = a.headline.toLowerCase()
    const d = a.detail.toLowerCase()
    return (
      h.includes('whale') ||
      d.includes('whale') ||
      h.includes('accumul') ||
      a.id.includes('whale')
    )
  })
  const smartMoney = demo?.smartMoney ?? null
  const weekly = demo?.weekly ?? null
  const smFlow = measured?.smartMoneyNetInflowUsd ?? smartMoney?.netFlowUsd ?? null
  const lpFlow = measured?.liquidityExpansionPct ?? null

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
      <div className="flex h-full min-h-0 flex-col border-l border-[var(--tit-border)] bg-[var(--tit-bg-1)] ">
        <div className="flex items-center justify-between border-b border-[var(--tit-border)] px-4 py-3">
          <p className="tit-section-title">Review trade</p>
          <button
            type="button"
            onClick={() => setReviewOpen(false)}
            className="tit-mono text-[0.65rem] text-[var(--tit-accent-bright)] underline-offset-2 hover:underline"
          >
            ← Intelligence
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
  const convictionPct = conviction != null ? Math.min(100, Math.max(0, conviction)) : 0

  return (
    <aside
      className="flex h-full min-h-0 flex-col overflow-hidden border-l border-[var(--tit-border)] bg-[var(--tit-bg-1)] backdrop-blur-xl"
      aria-label="Coach AI Intelligence Desk"
    >
      {/* Desk header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--tit-border)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--tit-accent)]/12 text-[var(--tit-accent-bright)] ring-1 ring-[var(--tit-accent)]/25">
            <Radio className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="tit-display text-[0.8rem] font-semibold tracking-tight">Coach AI</p>
            <p className="tit-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--tit-text-2)]">
              Research desk
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-[var(--tit-pos)]/25 bg-[var(--tit-pos)]/8 px-2 py-0.5">
          <span className="tit-pulse" />
          <span className="tit-mono text-[0.55rem] font-semibold text-[var(--tit-pos)]">ONLINE</span>
        </span>
      </div>

      <div className="tit-scroll min-h-0 flex-1 overflow-y-auto">
        {/* Coach watching */}
        {nudges.length > 0 ? (
          <section className="tit-intel-section">
            <SectionHeader title="Coach Watching" live />
            <div className="space-y-1.5">
              {nudges.slice(0, 2).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onQueueClick(n.mint, n.symbol, n.suggestedAction)}
                  className={`tit-intel-card flex w-full items-start gap-2.5 px-2.5 py-2 text-left ${
                    n.kind === 'defense'
                      ? '!border-[var(--tit-warn)]/35'
                      : '!border-[var(--tit-pos)]/30'
                  }`}
                >
                  {n.kind === 'defense' ? (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tit-warn)]" />
                  ) : (
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tit-pos)]" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-[0.72rem] leading-snug text-[var(--tit-text-0)]">
                      {n.message}
                    </span>
                    <span className="tit-mono text-[0.52rem] text-[var(--tit-text-2)]">
                      conf {n.confidencePct}% · {n.suggestedAction} · NFA
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* AI Conviction */}
        <section className="tit-intel-section">
          <SectionHeader title="AI Conviction" live={Boolean(hero || verdict)} />
          <h2 className="tit-headline">
            {headline.includes(' ') ? (
              <>
                {headline.split(' ').slice(0, -1).join(' ')}{' '}
                <span className="tit-headline-gradient">{headline.split(' ').slice(-1)[0]}</span>
              </>
            ) : (
              headline
            )}
          </h2>
          {verdict ? (
            <span
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide"
              style={{
                color: VERDICT_COLOR[verdict] ?? 'var(--tit-text-1)',
                background: `color-mix(in srgb, ${VERDICT_COLOR[verdict] ?? '#888'} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${VERDICT_COLOR[verdict] ?? '#888'} 32%, transparent)`,
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {verdict}
            </span>
          ) : null}

          {/* Animated confidence meter */}
          <div className="mt-3.5 space-y-2">
            <div className="flex items-end justify-between">
              <div>
                <p className="tit-label !mb-1">Conviction</p>
                <p className="tit-mono text-[1.35rem] font-bold leading-none text-[var(--tit-text-0)]">
                  {conviction ?? '—'}
                  <span className="ml-0.5 text-[0.7rem] font-medium text-[var(--tit-text-2)]">
                    /100
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="tit-label !mb-1">Confidence</p>
                <p className="tit-mono text-[0.95rem] font-semibold text-[var(--tit-text-0)]">
                  {confidence != null ? `${confidence}%` : '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="tit-label !mb-1">Coverage</p>
                <p className="tit-mono text-[0.95rem] font-semibold text-[var(--tit-text-0)]">
                  {coverage != null ? `${coverage}%` : '—'}
                </p>
              </div>
            </div>
            <div className="tit-meter h-1.5">
              <span
                className="tit-meter-fill tit-meter-glow"
                style={{
                  width: `${convictionPct}%`,
                  background: 'linear-gradient(90deg, var(--tit-accent), var(--tit-pos))',
                  color: 'var(--tit-pos)',
                }}
              />
            </div>
            {riskScore != null ? (
              <p className="tit-mono text-[0.55rem] text-[var(--tit-text-2)]">
                Risk {riskScore}/100 · {intel.methodNote}
              </p>
            ) : (
              <p className="tit-mono text-[0.55rem] text-[var(--tit-text-2)]">{intel.methodNote}</p>
            )}
          </div>
        </section>

        {/* AI Recommendations */}
        <section className="tit-intel-section">
          <SectionHeader title="AI Recommendations" />
          {why.length === 0 ? (
            <p className="text-[0.72rem] text-[var(--tit-text-1)]">
              {dataMode === 'live' ? 'Insufficient evidence to attribute.' : '—'}
            </p>
          ) : (
            <ul className="space-y-2">
              {why.map((w) => (
                <li key={`${w.label ?? ''}:${w.text}`} className="text-[0.74rem] leading-snug">
                  <div className="flex items-start gap-2">
                    <Check
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        w.ok ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-warn)]'
                      }`}
                    />
                    <span className="min-w-0 flex-1 text-[var(--tit-text-0)]">
                      {w.label ? (
                        <span className="tit-mono mr-1.5 text-[0.55rem] font-bold text-[var(--tit-text-2)]">
                          {w.label}
                        </span>
                      ) : null}
                      {w.text}
                    </span>
                    {w.sharePct != null ? (
                      <span
                        className={`tit-mono shrink-0 text-[0.68rem] font-bold ${
                          w.ok ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-warn)]'
                        }`}
                      >
                        {w.sharePct}%
                      </span>
                    ) : null}
                  </div>
                  {w.sharePct != null ? (
                    <div className="tit-meter ml-5 mt-1">
                      <span
                        className="tit-meter-fill"
                        style={{
                          width: `${Math.min(100, w.sharePct)}%`,
                          background: w.ok ? 'var(--tit-pos)' : 'var(--tit-warn)',
                        }}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {attribution ? (
            <p className="tit-mono mt-2 text-[0.5rem] text-[var(--tit-text-2)]">
              {attribution.method} · conf {attribution.confidencePct}% · {attribution.disclaimer}
            </p>
          ) : null}
        </section>

        {/* Risk Analysis */}
        <section className="tit-intel-section">
          <SectionHeader title="Risk Analysis" />
          <div className="mb-3 space-y-2">
            <ImpactBar label="Current exposure" pct={before} />
            <ImpactBar label="After trade" pct={after} accent />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`tit-mono rounded-md px-1.5 py-0.5 text-[0.62rem] font-bold ${
                impact.riskLevel === 'HIGH'
                  ? 'bg-[var(--tit-neg)]/12 text-[var(--tit-neg)]'
                  : impact.riskLevel === 'MEDIUM'
                    ? 'bg-[var(--tit-warn)]/12 text-[var(--tit-warn)]'
                    : 'bg-[var(--tit-pos)]/12 text-[var(--tit-pos)]'
              }`}
            >
              Risk {impact.riskLevel ?? demo?.tradePlan.riskLevel ?? '—'}
            </span>
            {before != null && after != null ? (
              <span className="tit-mono text-[0.62rem] text-[var(--tit-text-2)]">
                Δ concentration {after - before >= 0 ? '+' : ''}
                {(after - before).toFixed(1)}%
              </span>
            ) : null}
          </div>
          {!riskAnalysis ? (
            <p className="text-[0.68rem] text-[var(--tit-text-1)]">
              {dataMode === 'live' ? 'Connect wallet for risk gauges.' : '—'}
            </p>
          ) : (
            <ul className="space-y-2">
              {(
                [
                  ['Concentration', riskAnalysis.concentration],
                  ['Liquidity', riskAnalysis.liquidity],
                  ['Correlation', riskAnalysis.correlation],
                  ['Volatility', riskAnalysis.volatility],
                  ['Smart money', riskAnalysis.smartMoney],
                ] as const
              ).map(([label, level]) => (
                <li key={label}>
                  <div className="mb-1 flex justify-between text-[0.62rem]">
                    <span className="text-[var(--tit-text-1)]">{label}</span>
                    <span className="tit-mono font-bold" style={{ color: riskBarColor(level) }}>
                      {level}
                    </span>
                  </div>
                  <div className="tit-meter">
                    <span
                      className="tit-meter-fill"
                      style={{ width: riskWidth(level), background: riskBarColor(level) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Whale Activity */}
        <section className="tit-intel-section">
          <SectionHeader title="Whale Activity" live={Boolean(measured || whaleAlerts.length)} />
          {measured || whaleAlerts.length || smartMoney ? (
            <div className="space-y-2.5">
              <div className="tit-intel-card flex items-center gap-3 px-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tit-info)]/12 text-[var(--tit-info)]">
                  <Fish className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="tit-label !mb-0.5">Insider / deployer cluster</p>
                  <p className="tit-mono text-[0.78rem] font-semibold text-[var(--tit-text-0)]">
                    {measured?.insiderClusterActive ? (
                      <span className="text-[var(--tit-warn)]">Active · elevated</span>
                    ) : (
                      <span className="text-[var(--tit-pos)]">Quiet · no cluster flags</span>
                    )}
                  </p>
                </div>
              </div>
              {(whaleAlerts.length ? whaleAlerts : alerts.filter((a) => a.severity === 'high' || a.severity === 'critical'))
                .slice(0, 3)
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="tit-intel-card w-full px-2.5 py-2 text-left"
                    onClick={() => a.mint && a.symbol && selectMint(a.mint, a.symbol)}
                    disabled={!a.actionable || !a.mint}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`tit-mono rounded px-1 py-px text-[0.48rem] font-bold uppercase ${
                          a.severity === 'critical' || a.severity === 'high'
                            ? 'bg-[var(--tit-neg)]/12 text-[var(--tit-neg)]'
                            : 'bg-[var(--tit-warn)]/12 text-[var(--tit-warn)]'
                        }`}
                      >
                        {a.severity}
                      </span>
                      <span className="truncate text-[0.68rem] font-medium text-[var(--tit-text-0)]">
                        {a.headline}
                      </span>
                    </span>
                    <span className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">
                      {relativeTime(a.at)} · {a.source}
                    </span>
                  </button>
                ))}
            </div>
          ) : (
            <p className="text-[0.68rem] text-[var(--tit-text-1)]">
              {dataMode === 'live' ? 'Awaiting whale feed for focus mint.' : '—'}
            </p>
          )}
        </section>

        {/* Smart Money Flow */}
        <section className="tit-intel-section">
          <SectionHeader title="Smart Money Flow" live={smFlow != null} />
          {smFlow != null || smartMoney ? (
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="tit-label !mb-1">Net inflow</p>
                  <p
                    className={`tit-mono flex items-center gap-1 text-[1.2rem] font-bold leading-none ${
                      (smFlow ?? 0) >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                    }`}
                  >
                    {(smFlow ?? 0) >= 0 ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                    {formatFlow(smFlow ?? 0)}
                  </p>
                </div>
                {lpFlow != null ? (
                  <div className="text-right">
                    <p className="tit-label !mb-1">Liquidity Δ</p>
                    <p
                      className={`tit-mono text-[0.95rem] font-semibold ${
                        lpFlow >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                      }`}
                    >
                      {lpFlow >= 0 ? '+' : ''}
                      {lpFlow.toFixed(1)}%
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="tit-flow-bar">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.abs(smFlow ?? 0) / 2000)}%`,
                    background:
                      (smFlow ?? 0) >= 0
                        ? 'linear-gradient(90deg, transparent, var(--tit-pos))'
                        : 'linear-gradient(90deg, transparent, var(--tit-neg))',
                  }}
                />
              </div>
              {smartMoney?.notable?.length ? (
                <ul className="space-y-1">
                  {smartMoney.notable.slice(0, 3).map((n) => (
                    <li
                      key={n}
                      className="flex items-start gap-2 text-[0.68rem] text-[var(--tit-text-1)]"
                    >
                      <Waves className="mt-0.5 h-3 w-3 shrink-0 text-[var(--tit-accent)]" />
                      {n}
                    </li>
                  ))}
                </ul>
              ) : measured ? (
                <p className="flex items-start gap-2 text-[0.68rem] text-[var(--tit-text-1)]">
                  <Activity className="mt-0.5 h-3 w-3 shrink-0 text-[var(--tit-accent)]" />
                  Holders {measured.holderGrowthPct >= 0 ? '+' : ''}
                  {measured.holderGrowthPct.toFixed(1)}% · pool age{' '}
                  {measured.poolAgeHours != null ? `${Math.round(measured.poolAgeHours)}h` : '—'}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-[0.68rem] text-[var(--tit-text-1)]">
              {dataMode === 'live' ? 'Smart-money feed pending for live mode.' : '—'}
            </p>
          )}
        </section>

        {/* Market Narrative */}
        <section className="tit-intel-section">
          <SectionHeader title="Market Narrative" />
          {weekly ? (
            <div className="space-y-2.5">
              <p className="text-[0.78rem] leading-relaxed text-[var(--tit-text-0)]">
                {weekly.summary}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <NarrativeChip label="Theme" value={weekly.topNarrative} />
                <NarrativeChip label="Rotation" value={weekly.smartMoneyRotation} />
                <NarrativeChip label="Conviction" value={weekly.convictionSector} />
                <NarrativeChip label="Biggest risk" value={weekly.biggestRisk} warn />
              </div>
              {dataMode === 'demo' ? <span className="tit-sample-tag">Sample</span> : null}
            </div>
          ) : (
            <p className="text-[0.68rem] text-[var(--tit-text-1)]">
              {dataMode === 'live'
                ? 'Narrative desk feed not connected — scan focus mint for local thesis.'
                : '—'}
            </p>
          )}
        </section>

        {/* Execution Queue */}
        <section className="tit-intel-section !border-b-0">
          <SectionHeader title="Execution Queue" />
          {actionQueue.length === 0 ? (
            <p className="text-[0.72rem] text-[var(--tit-text-1)]">
              No priority actions — book is balanced.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {actionQueue.slice(0, 5).map((a, i) => (
                <li key={`${a.type}-${a.mint}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onQueueClick(a.mint, a.symbol, a.type)}
                    className="tit-intel-card flex w-full items-start gap-2.5 px-2.5 py-2.5 text-left"
                  >
                    <span className="tit-mono mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--tit-bg-3)] text-[0.65rem] font-bold text-[var(--tit-text-2)]">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`tit-mono text-[0.82rem] font-bold ${actionTone(a.type)}`}>
                        {a.type} {a.symbol}
                      </span>
                      <span className="mt-0.5 block text-[0.65rem] leading-snug text-[var(--tit-text-1)]">
                        {a.reason}
                      </span>
                      {'sourceEngine' in a && a.sourceEngine ? (
                        <span className="tit-mono text-[0.48rem] text-[var(--tit-text-2)]">
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
      </div>

      <div className="shrink-0 border-t border-[var(--tit-border)] bg-[rgba(11,17,24,0.75)] p-3 ">
        <button
          type="button"
          onClick={onReview}
          className="tit-btn-accent w-full py-3 text-[0.82rem] font-bold tracking-wide"
        >
          REVIEW TRADE →
        </button>
        <p className="tit-compliance mt-2 text-center">{COMPLIANCE_DISCLAIMER}</p>
      </div>
    </aside>
  )
}

function NarrativeChip({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="tit-intel-card px-2.5 py-2">
      <p className="tit-label !mb-1">{label}</p>
      <p
        className={`text-[0.7rem] font-medium leading-snug ${
          warn ? 'text-[var(--tit-warn)]' : 'text-[var(--tit-text-0)]'
        }`}
      >
        {value}
      </p>
    </div>
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
      <div className="mb-1 flex justify-between text-[0.62rem]">
        <span className="text-[var(--tit-text-1)]">{label}</span>
        <span className="tit-mono font-semibold text-[var(--tit-text-0)]">
          {pct != null ? `${pct.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="tit-meter h-1.5">
        <span
          className="tit-meter-fill"
          style={{
            width: `${w}%`,
            background: accent
              ? 'linear-gradient(90deg, var(--tit-accent-dim), var(--tit-accent))'
              : 'var(--tit-text-2)',
          }}
        />
      </div>
    </div>
  )
}
