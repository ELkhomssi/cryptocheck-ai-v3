'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Lock,
  OctagonAlert,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import { buildCoachAction } from '@/lib/trading-terminal/coach-action'
import { buildCoachTradePlan } from '@/lib/trading-terminal/coach-trade-plan'
import { COMPLIANCE_DISCLAIMER } from '@/lib/trading-terminal/constants'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import { scanToVerdictCard } from '@/lib/trading-terminal/map-verdict'
import { computePortfolioImpact } from '@/lib/trading-terminal/portfolio-impact'
import {
  isSimilarSetupsReady,
  loadSimilarSetups,
  type SimilarSetupsReady,
} from '@/lib/trading-terminal/similar-setups'
import type { TerminalVerdict } from '@/lib/trading-terminal/types'
import { loadWeeklyIntel } from '@/lib/trading-terminal/weekly-intel'
import { BehaviorCoachPanel } from './BehaviorCoachPanel'
import { CoachTrackRecord } from './CoachTrackRecord'
import { TradeOutcomesPanel } from './TradeOutcomesPanel'
import { useTerminalFocus } from './TerminalFocusProvider'

export type CoachRailTab = 'intel' | 'record' | 'brief' | 'behavior' | 'outcomes'

const VERDICT_STYLE: Record<
  TerminalVerdict,
  { color: string; label: string; glow: string }
> = {
  SAFE: { color: 'var(--tit-safe)', label: 'SAFE', glow: 'rgba(34,197,94,0.35)' },
  CAUTION: { color: 'var(--tit-caution)', label: 'CAUTION', glow: 'rgba(234,179,8,0.35)' },
  HIGH_RISK: { color: 'var(--tit-danger)', label: 'DANGER', glow: 'rgba(240,68,56,0.4)' },
  BLOCKED: { color: 'var(--tit-blocked)', label: 'BLOCKED', glow: 'rgba(239,68,68,0.45)' },
  INSUFFICIENT_DATA: {
    color: 'var(--tit-text-2)',
    label: 'INSUFFICIENT',
    glow: 'transparent',
  },
}

function VerdictIcon({ verdict }: { verdict: TerminalVerdict }) {
  const c = VERDICT_STYLE[verdict].color
  if (verdict === 'SAFE') return <ShieldCheck className="h-6 w-6" style={{ color: c }} />
  if (verdict === 'CAUTION') return <AlertTriangle className="h-6 w-6" style={{ color: c }} />
  if (verdict === 'HIGH_RISK') return <OctagonAlert className="h-6 w-6" style={{ color: c }} />
  if (verdict === 'BLOCKED') return <Lock className="h-6 w-6" style={{ color: c }} />
  return <AlertTriangle className="h-6 w-6" style={{ color: c }} />
}

function Section({
  title,
  children,
  collapsed,
  oneLiner,
}: {
  title: string
  children?: ReactNode
  collapsed?: boolean
  oneLiner?: string
}) {
  if (collapsed) {
    return (
      <div className="border-b border-[var(--tit-border)] px-2.5 py-1.5">
        <p className="tit-label opacity-70">{title}</p>
        {oneLiner ? (
          <p className="text-[0.6rem] text-[var(--tit-text-2)]">{oneLiner}</p>
        ) : null}
      </div>
    )
  }
  return (
    <section className="border-b border-[var(--tit-border)] px-2.5 py-2">
      <p className="tit-label mb-1.5">{title}</p>
      {children}
    </section>
  )
}

type Props = {
  tab: CoachRailTab
  onTab: (t: CoachRailTab) => void
}

/**
 * Intelligence workstation — research stack above pinned execution.
 * Demo mode fills from DEMO_SEED coach bundle; live uses scan + honest empties.
 */
export function IntelligenceColumn({ tab, onTab }: Props) {
  const {
    scan,
    scanning,
    scanError,
    focusMint,
    focusSymbol,
    focusSignal,
    coachCollapsed,
    portfolioTotalUsd,
    positionValueUsd,
    ticketAmountSol,
    ticketSide,
    solPriceUsd,
    dataMode,
    selectMint,
  } = useTerminalFocus()

  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])
  const demoCoach = snap.coach.status === 'ready' ? snap.coach.data : null
  const card = scanToVerdictCard(scan)
  const focused = Boolean(focusMint) || dataMode === 'demo'

  const [weekly, setWeekly] = useState(() =>
    typeof window === 'undefined' ? null : loadWeeklyIntel(),
  )
  useEffect(() => {
    setWeekly(loadWeeklyIntel())
  }, [focusMint, dataMode])

  const displayVerdict: TerminalVerdict | null = demoCoach
    ? demoCoach.verdict === 'DANGER'
      ? 'HIGH_RISK'
      : demoCoach.verdict === 'BLOCKED'
        ? 'BLOCKED'
        : demoCoach.verdict === 'SAFE'
          ? 'SAFE'
          : demoCoach.verdict === 'CAUTION'
            ? 'CAUTION'
            : 'INSUFFICIENT_DATA'
    : card?.verdict ?? null

  const evidenceBullets = useMemo(() => {
    if (demoCoach) {
      return demoCoach.why.map((w) => ({
        text: w.text,
        direction: w.direction,
        source: w.sourceField,
      }))
    }
    if (!card) return []
    const out: { text: string; direction: 'up' | 'risk'; source: string }[] = []
    for (const w of card.why) {
      if (out.length >= 5) break
      out.push({ text: w.text, direction: 'up', source: w.source })
    }
    for (const r of card.risks) {
      if (out.length >= 5) break
      out.push({ text: r.text, direction: 'risk', source: r.source })
    }
    return out
  }, [card, demoCoach])

  const action = useMemo(() => {
    if (demoCoach) {
      return { interpretation: demoCoach.action, ruleIds: ['demo_seed'] }
    }
    return buildCoachAction({
      verdict: card?.verdict ?? null,
      riskScore: card?.riskScore ?? null,
      why: card?.why ?? [],
      risks: card?.risks ?? [],
    })
  }, [card, demoCoach])

  const markPrice = useMemo(() => {
    if (demoCoach && snap.discover.status === 'ready') {
      const t = snap.discover.data.find((d) => d.mint === demoCoach.mint)
      return t?.priceUsd ?? null
    }
    if (typeof focusSignal?.value === 'number' && focusSignal.value > 0) return focusSignal.value
    return null
  }, [demoCoach, snap.discover, focusSignal])

  const demoBookTotal =
    snap.portions.status === 'ready' ? snap.portions.data.totalUsd : 0
  const demoPosValue =
    snap.positions.status === 'ready'
      ? snap.positions.data.find((p) => p.mint === (demoCoach?.mint || focusMint))?.valueUsd ?? 0
      : 0

  const tradePlan = useMemo(() => {
    if (demoCoach)
      return {
        ...demoCoach.tradePlan,
        insufficient: false as const,
        takeProfitTargets: demoCoach.tradePlan.takeProfits,
        suggestedPositionSize: demoCoach.tradePlan.suggestedSize,
        entryZone: demoCoach.tradePlan.entryZone,
        riskLevel: demoCoach.tradePlan.riskLevel,
        invalidation: demoCoach.tradePlan.invalidation,
        ruleIds: ['demo'],
      }
    return buildCoachTradePlan({
      verdict: card?.verdict ?? null,
      riskScore: card?.riskScore ?? null,
      safetyScore: card?.safetyScore ?? null,
      markPriceUsd: markPrice,
      liquidityUsd: null,
      volatilityPct: null,
      portfolioTotalUsd,
      ticketAmountSol,
      solPriceUsd,
    })
  }, [demoCoach, card, markPrice, portfolioTotalUsd, ticketAmountSol, solPriceUsd])

  const ticketUsd =
    ticketAmountSol > 0 && solPriceUsd != null && solPriceUsd > 0
      ? ticketAmountSol * solPriceUsd
      : null

  const impact = useMemo(
    () =>
      computePortfolioImpact({
        portfolioTotalUsd: portfolioTotalUsd || demoBookTotal,
        currentPositionUsd: focusMint
          ? positionValueUsd(focusMint) ?? demoPosValue
          : demoPosValue,
        ticketUsd,
        side: ticketSide,
      }),
    [
      portfolioTotalUsd,
      demoBookTotal,
      focusMint,
      positionValueUsd,
      demoPosValue,
      ticketUsd,
      ticketSide,
    ],
  )

  const similarReady: SimilarSetupsReady | null = demoCoach
    ? {
        insufficient: false,
        count: demoCoach.similar.count,
        avgOutcomePct: demoCoach.similar.avgOutcomePct,
        winRatePct: demoCoach.similar.winRatePct,
        avgHoldDays: demoCoach.similar.avgHoldDays,
      }
    : (() => {
        const s = loadSimilarSetups()
        return isSimilarSetupsReady(s) ? s : null
      })()

  if (coachCollapsed) {
    return (
      <div className="tit-panel-flat px-3 py-2">
        <p className="tit-label">AI Coach · collapsed (C)</p>
      </div>
    )
  }

  const riskScore = demoCoach?.riskScore ?? card?.riskScore ?? null
  const coveragePct = demoCoach
    ? demoCoach.evidenceCoveragePct
    : card
      ? Math.round(card.evidence.coverage * 100)
      : null
  const confidencePct = demoCoach
    ? demoCoach.confidencePct
    : card
      ? Math.round(card.evidence.coverage * 100)
      : null

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="AI Coach intelligence workstation">
      <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-[var(--tit-border)] px-1 py-1">
        {(
          [
            ['intel', 'Intel', 'V'],
            ['record', 'Record', 'T'],
            ['outcomes', 'Marks', 'M'],
            ['behavior', 'Behav', 'H'],
            ['brief', 'Brief', 'R'],
          ] as const
        ).map(([id, label, key]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={`tit-mono shrink-0 rounded px-1.5 py-1 text-[0.55rem] ${
              tab === id
                ? 'bg-[var(--tit-accent)]/20 text-[var(--tit-accent-bright)]'
                : 'text-[var(--tit-text-2)] hover:text-[var(--tit-text-1)]'
            }`}
          >
            {label} ({key})
          </button>
        ))}
      </div>

      {tab === 'record' ? (
        <div className="tit-scroll min-h-0 flex-1 overflow-y-auto">
          <CoachTrackRecord />
        </div>
      ) : null}
      {tab === 'outcomes' ? (
        <div className="tit-scroll min-h-0 flex-1 overflow-y-auto">
          <TradeOutcomesPanel />
        </div>
      ) : null}
      {tab === 'behavior' ? (
        <div className="tit-scroll min-h-0 flex-1 overflow-y-auto">
          <BehaviorCoachPanel />
        </div>
      ) : null}

      {(tab === 'intel' || tab === 'brief') && (
        <div className="tit-scroll min-h-0 flex-1 overflow-y-auto bg-[var(--tit-bg-1)]">
          {tab === 'brief' ? (
            <Section title="Weekly Intelligence">
              <WeeklyBlock
                demo={demoCoach?.weekly ?? null}
                weekly={weekly}
                sample={Boolean(demoCoach)}
              />
            </Section>
          ) : (
            <>
              {/* 1 VERDICT */}
              <section className="border-b border-[var(--tit-border)] px-2.5 py-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="tit-label">Verdict</p>
                    <p className="tit-mono text-[0.8rem] font-bold text-[var(--tit-text-0)]">
                      {demoCoach?.symbol || focusSymbol || 'Select a symbol'}
                      {demoCoach ? (
                        <span className="ml-1 text-[0.55rem] font-normal text-[var(--tit-text-2)]">
                          {demoCoach.name}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {(card?.sample || demoCoach) && dataMode === 'demo' ? (
                    <span className="tit-sample-tag">demo</span>
                  ) : card?.sample ? (
                    <span className="tit-sample-tag">sample</span>
                  ) : null}
                </div>

                {!focused && dataMode === 'live' ? (
                  <p className="text-[0.7rem] text-[var(--tit-text-1)]">
                    Select a symbol from Discover to analyze.
                  </p>
                ) : null}
                {scanning ? (
                  <div className="flex items-center gap-2 text-[0.7rem] text-[var(--tit-text-1)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Scanning…
                  </div>
                ) : null}
                {scanError && dataMode === 'live' ? (
                  <p className="text-[0.7rem] text-[var(--tit-neg)]" role="alert">
                    {scanError}
                  </p>
                ) : null}

                {displayVerdict && !scanning ? (
                  <>
                    <div
                      className="mt-1 flex items-center gap-3 rounded-lg border px-3 py-3"
                      style={{
                        borderColor: VERDICT_STYLE[displayVerdict].color,
                        boxShadow: `0 0 24px ${VERDICT_STYLE[displayVerdict].glow}`,
                        background: `color-mix(in srgb, ${VERDICT_STYLE[displayVerdict].color} 12%, transparent)`,
                      }}
                    >
                      <VerdictIcon verdict={displayVerdict} />
                      <span
                        className="tit-mono text-2xl font-black tracking-wide"
                        style={{ color: VERDICT_STYLE[displayVerdict].color }}
                      >
                        {VERDICT_STYLE[displayVerdict].label}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <Metric label="Risk" value={riskScore != null ? String(riskScore) : null} />
                      <Metric
                        label="Confidence"
                        value={confidencePct != null ? `${confidencePct}%` : null}
                        caption="from evidence coverage"
                      />
                      <Metric
                        label="Coverage"
                        value={coveragePct != null ? `${coveragePct}%` : null}
                      />
                    </div>
                  </>
                ) : null}
              </section>

              <Section
                title="Why"
                collapsed={!focused}
                oneLiner="Select a symbol for evidence."
              >
                {evidenceBullets.length === 0 ? (
                  <p className="text-[0.65rem] text-[var(--tit-text-1)]">
                    Insufficient evidence.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {evidenceBullets.map((b, i) => (
                      <li
                        key={`${b.source}-${i}`}
                        className={`flex gap-1.5 text-[0.7rem] ${
                          b.direction === 'up' ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                        }`}
                      >
                        <span aria-hidden>{b.direction === 'up' ? '▲' : '▼'}</span>
                        <span>
                          {b.text}
                          <span className="mt-0.5 block text-[0.5rem] text-[var(--tit-text-2)]">
                            {b.source}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="What AI Coach Would Do" collapsed={!focused}>
                {action ? (
                  <>
                    <p className="text-[0.75rem] font-medium text-[var(--tit-text-0)]">
                      {action.interpretation}
                    </p>
                    <p className="tit-compliance mt-1.5">
                      Rules-based interpretation of on-chain evidence. {COMPLIANCE_DISCLAIMER}
                    </p>
                  </>
                ) : (
                  <p className="text-[0.65rem] text-[var(--tit-text-1)]">
                    Awaiting verdict.
                  </p>
                )}
              </Section>

              <Section title="Trade Plan" collapsed={!focused}>
                {'insufficient' in tradePlan && tradePlan.insufficient ? (
                  <p className="text-[0.65rem] text-[var(--tit-text-1)]">
                    Insufficient evidence for a trade plan.
                  </p>
                ) : (
                  <dl className="grid grid-cols-1 gap-1.5 text-[0.7rem]">
                    <PlanRow label="Entry Zone" value={tradePlan.entryZone} />
                    <PlanRow label="Risk Level" value={tradePlan.riskLevel} />
                    <PlanRow label="Invalidation" value={tradePlan.invalidation} />
                    <div>
                      <dt className="tit-label !text-[9px]">Take Profit Targets</dt>
                      <dd className="tit-mono text-[var(--tit-pos)]">
                        {('takeProfitTargets' in tradePlan
                          ? tradePlan.takeProfitTargets
                          : []
                        ).join(' · ') || '—'}
                      </dd>
                    </div>
                    <PlanRow
                      label="Suggested Size"
                      value={
                        'suggestedPositionSize' in tradePlan
                          ? tradePlan.suggestedPositionSize
                          : null
                      }
                    />
                  </dl>
                )}
              </Section>

              <Section
                title="Portfolio Health"
                collapsed={!focused && !demoCoach}
                oneLiner="Connect a wallet to analyze your book."
              >
                {demoCoach ? (
                  <>
                    <p className="tit-mono text-[1rem] font-bold text-[var(--tit-text-0)]">
                      {demoCoach.portfolioHealth.score}
                      <span className="ml-1 text-[0.55rem] font-normal text-[var(--tit-text-2)]">
                        /100
                      </span>
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {demoCoach.portfolioHealth.issues.map((i) => (
                        <li key={i} className="text-[0.65rem] text-[var(--tit-warn)]">
                          · {i}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-[0.65rem] text-[var(--tit-text-1)]">
                    Connect a wallet to analyze your book.
                  </p>
                )}
              </Section>

              <Section title="Risk Exposure" collapsed={!demoCoach} oneLiner="Awaiting portfolio.">
                {demoCoach ? (
                  <>
                    <ul className="space-y-0.5">
                      {demoCoach.riskExposure.categories.map((c) => (
                        <li key={c.name} className="flex justify-between text-[0.65rem]">
                          <span className="text-[var(--tit-text-1)]">{c.name}</span>
                          <span className="tit-mono text-[var(--tit-text-0)]">{c.pct}%</span>
                        </li>
                      ))}
                    </ul>
                    {demoCoach.riskExposure.flags.map((f) => (
                      <p key={f} className="mt-1 text-[0.6rem] text-[var(--tit-warn)]">
                        {f}
                      </p>
                    ))}
                  </>
                ) : null}
              </Section>

              <Section
                title="AI Opportunity Radar"
                collapsed={!demoCoach}
                oneLiner="No qualifying opportunities right now."
              >
                {demoCoach?.opportunities.length ? (
                  <ul className="space-y-1">
                    {demoCoach.opportunities.map((o) => (
                      <li key={o.symbol}>
                        <button
                          type="button"
                          className="w-full text-left text-[0.7rem]"
                          onClick={() => {
                            const t = snap.discover.status === 'ready'
                              ? snap.discover.data.find((d) => d.symbol === o.symbol)
                              : null
                            if (t) selectMint(t.mint, t.symbol)
                          }}
                        >
                          <span className="tit-mono font-bold text-[var(--tit-accent-bright)]">
                            {o.symbol}
                          </span>{' '}
                          <span className="text-[var(--tit-text-1)]">{o.reason}</span>
                          <span className="tit-mono ml-1 text-[var(--tit-text-2)]">
                            conv {o.conviction}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[0.65rem] text-[var(--tit-text-1)]">
                    No qualifying opportunities right now.
                  </p>
                )}
              </Section>

              <Section
                title="AI Threat Radar"
                collapsed={!demoCoach}
                oneLiner="No active threats on held positions."
              >
                {demoCoach?.threats.length ? (
                  <ul className="space-y-1">
                    {demoCoach.threats.map((t) => (
                      <li key={t.symbol} className="text-[0.7rem] text-[var(--tit-neg)]">
                        <span className="tit-mono font-bold">{t.symbol}</span> · {t.reason}{' '}
                        <span className="tit-badge tit-badge-risk">{t.severity}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[0.65rem] text-[var(--tit-text-1)]">
                    No active threats on held positions.
                  </p>
                )}
              </Section>

              <Section
                title="Smart Money Analysis"
                collapsed={!demoCoach}
                oneLiner="Awaiting on-chain smart-money feed."
              >
                {demoCoach ? (
                  <>
                    <p className="tit-mono text-[0.75rem] text-[var(--tit-text-0)]">
                      Net flow{' '}
                      <span
                        className={
                          demoCoach.smartMoney.netFlowUsd >= 0
                            ? 'text-[var(--tit-pos)]'
                            : 'text-[var(--tit-neg)]'
                        }
                      >
                        {demoCoach.smartMoney.netFlowUsd >= 0 ? '+' : ''}$
                        {demoCoach.smartMoney.netFlowUsd.toLocaleString()}
                      </span>
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {demoCoach.smartMoney.notable.map((n) => (
                        <li key={n} className="text-[0.65rem] text-[var(--tit-text-1)]">
                          · {n}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </Section>

              <Section
                title="Capital Allocation"
                collapsed={!demoCoach}
                oneLiner="Guidance available after scan + portfolio load."
              >
                {demoCoach ? (
                  <p className="text-[0.7rem] text-[var(--tit-text-0)]">
                    {demoCoach.capitalAllocation}
                  </p>
                ) : null}
              </Section>

              <Section title="Portfolio Impact" collapsed={!focused && !demoCoach}>
                {impact.awaiting && !demoCoach ? (
                  <p className="text-[0.65rem] text-[var(--tit-text-1)]">
                    Connect wallet to project impact.
                  </p>
                ) : (
                  <>
                    <p className="tit-mono text-[0.75rem] text-[var(--tit-text-0)]">
                      {impact.metric}:{' '}
                      {impact.beforePct != null ? `${impact.beforePct.toFixed(1)}%` : '—'}
                      {impact.afterPct != null ? (
                        <>
                          {' '}
                          →{' '}
                          <span className="text-[var(--tit-accent-bright)]">
                            {impact.afterPct.toFixed(1)}%
                          </span>
                        </>
                      ) : null}
                    </p>
                    {impact.riskLevel ? (
                      <span
                        className={`tit-badge mt-1 ${
                          impact.riskLevel === 'HIGH'
                            ? 'tit-badge-risk'
                            : impact.riskLevel === 'MEDIUM'
                              ? 'tit-badge-hot'
                              : 'tit-badge-safe'
                        }`}
                      >
                        Portfolio risk {impact.riskLevel}
                      </span>
                    ) : null}
                    <ul className="mt-1.5 space-y-0.5">
                      {impact.observations.map((o) => (
                        <li key={o} className="text-[0.65rem] text-[var(--tit-text-1)]">
                          · {o}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Section>

              <Section title="Similar Setups" collapsed={!focused && !demoCoach}>
                {!similarReady ? (
                  <p className="text-[0.7rem] text-[var(--tit-text-1)]">
                    Not enough historical evidence.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 tit-mono text-[0.7rem]">
                    <span>Found {similarReady.count}</span>
                    <span className="text-[var(--tit-pos)]">
                      Avg +{similarReady.avgOutcomePct}%
                    </span>
                    <span>Win {similarReady.winRatePct}%</span>
                    <span>Hold {similarReady.avgHoldDays}d</span>
                  </div>
                )}
              </Section>

              <Section
                title="AI Action Queue"
                collapsed={!demoCoach}
                oneLiner="No priority actions — book is balanced."
              >
                {demoCoach?.actionQueue.length ? (
                  <ul className="space-y-1">
                    {demoCoach.actionQueue.map((a) => (
                      <li
                        key={`${a.type}-${a.symbol}`}
                        className="rounded border border-[var(--tit-border)] bg-[var(--tit-bg-2)] px-2 py-1.5 text-[0.7rem]"
                      >
                        <span className="tit-mono font-bold text-[var(--tit-accent-bright)]">
                          {a.type}
                        </span>{' '}
                        <span className="tit-mono font-semibold">{a.symbol}</span>
                        <p className="text-[var(--tit-text-1)]">{a.reason}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[0.65rem] text-[var(--tit-text-1)]">
                    No priority actions — book is balanced.
                  </p>
                )}
              </Section>

              <Section title="Weekly Intelligence">
                <WeeklyBlock
                  demo={demoCoach?.weekly ?? null}
                  weekly={weekly}
                  sample={Boolean(demoCoach)}
                />
              </Section>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  caption,
}: {
  label: string
  value: string | null
  caption?: string
}) {
  return (
    <div className="rounded border border-[var(--tit-border)] bg-[var(--tit-bg-2)] px-1.5 py-1">
      <p className="tit-label !text-[9px]">{label}</p>
      <p className="tit-mono text-[0.8rem] font-semibold text-[var(--tit-text-0)]">{value ?? '—'}</p>
      {caption ? <p className="text-[0.45rem] text-[var(--tit-text-2)]">{caption}</p> : null}
    </div>
  )
}

function PlanRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="tit-label !text-[9px]">{label}</dt>
      <dd className="tit-mono text-[var(--tit-text-0)]">{value ?? '—'}</dd>
    </div>
  )
}

function WeeklyBlock({
  demo,
  weekly,
  sample,
}: {
  demo: {
    weekOf: string
    topNarrative: string
    smartMoneyRotation: string
    convictionSector: string
    biggestRisk: string
    summary: string
  } | null
  weekly: ReturnType<typeof loadWeeklyIntel> | null
  sample: boolean
}) {
  const weekOf = demo?.weekOf ?? weekly?.weekOf ?? '—'
  return (
    <div className="space-y-1.5 rounded border border-[var(--tit-accent-2)]/30 bg-[var(--tit-bg-2)]/80 px-2 py-2">
      <p className="tit-mono text-[0.55rem] text-[var(--tit-accent-2)]">
        Week of {weekOf}
        {sample ? <span className="tit-sample-tag ml-1">demo</span> : null}
      </p>
      <Field label="Top Narrative" value={demo?.topNarrative ?? weekly?.topNarrative ?? null} />
      <Field
        label="Smart Money Rotation"
        value={demo?.smartMoneyRotation ?? weekly?.smartMoneyRotation ?? null}
      />
      <Field
        label="Highest Conviction Sector"
        value={demo?.convictionSector ?? weekly?.convictionSector ?? null}
      />
      <Field label="Biggest Risk" value={demo?.biggestRisk ?? weekly?.biggestRisk ?? null} />
      <Field label="Coach Summary" value={demo?.summary ?? weekly?.summary ?? null} />
      {!demo && weekly?.personalLines?.length ? (
        <ul className="mt-1 space-y-0.5 border-t border-[var(--tit-border)] pt-1">
          {weekly.personalLines.map((l) => (
            <li key={l} className="text-[0.6rem] text-[var(--tit-text-1)]">
              {l}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <p className="text-[0.65rem]">
      <span className="text-[var(--tit-text-2)]">{label}: </span>
      <span className="text-[var(--tit-text-0)]">
        {value ?? <span className="text-[var(--tit-text-2)]">awaiting research feed</span>}
      </span>
    </p>
  )
}

export function useCoachRailTab() {
  return useState<CoachRailTab>('intel')
}

export { IntelligenceColumn as CoachRail }
