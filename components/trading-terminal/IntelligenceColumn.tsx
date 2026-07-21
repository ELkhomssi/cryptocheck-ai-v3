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
}: {
  title: string
  children: ReactNode
  collapsed?: boolean
}) {
  if (collapsed) {
    return (
      <div className="border-b border-[var(--tit-border)] px-2.5 py-1.5">
        <p className="tit-label opacity-60">{title}</p>
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
 * AI Coach Intelligence Column — stacked research sections + secondary drawers.
 * Verdict → Why → Action → Trade Plan → Portfolio Impact → Similar → Weekly.
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
  } = useTerminalFocus()

  const card = scanToVerdictCard(scan)
  const focused = Boolean(focusMint)
  const [weekly, setWeekly] = useState(() =>
    typeof window === 'undefined'
      ? null
      : loadWeeklyIntel(),
  )

  useEffect(() => {
    setWeekly(loadWeeklyIntel())
  }, [focusMint])

  const evidenceBullets = useMemo(() => {
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
  }, [card])

  const action = useMemo(
    () =>
      buildCoachAction({
        verdict: card?.verdict ?? null,
        riskScore: card?.riskScore ?? null,
        why: card?.why ?? [],
        risks: card?.risks ?? [],
      }),
    [card],
  )

  const markPrice =
    typeof focusSignal?.value === 'number' && focusSignal.value > 0 ? focusSignal.value : null

  const rawLiq = focusSignal?.rawPayload?.liquidityUsd
  const liquidityUsd = typeof rawLiq === 'number' ? rawLiq : null

  const tradePlan = useMemo(
    () =>
      buildCoachTradePlan({
        verdict: card?.verdict ?? null,
        riskScore: card?.riskScore ?? null,
        safetyScore: card?.safetyScore ?? null,
        markPriceUsd: markPrice,
        liquidityUsd,
        volatilityPct: null,
        portfolioTotalUsd,
        ticketAmountSol,
        solPriceUsd,
      }),
    [card, markPrice, liquidityUsd, portfolioTotalUsd, ticketAmountSol, solPriceUsd],
  )

  const ticketUsd =
    ticketAmountSol > 0 && solPriceUsd != null && solPriceUsd > 0
      ? ticketAmountSol * solPriceUsd
      : ticketAmountSol > 0
        ? null
        : null

  const impact = useMemo(
    () =>
      computePortfolioImpact({
        portfolioTotalUsd,
        currentPositionUsd: focusMint ? positionValueUsd(focusMint) ?? 0 : 0,
        ticketUsd,
        side: ticketSide,
      }),
    [portfolioTotalUsd, focusMint, positionValueUsd, ticketUsd, ticketSide],
  )

  const similarRaw = loadSimilarSetups()
  const similarReady: SimilarSetupsReady | null = isSimilarSetupsReady(similarRaw)
    ? similarRaw
    : null

  if (coachCollapsed) {
    return (
      <div className="tit-panel-flat px-3 py-2">
        <p className="tit-label">AI Coach · collapsed (C)</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="AI Coach intelligence">
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
      {tab === 'brief' || tab === 'intel' ? null : null}

      {(tab === 'intel' || tab === 'brief') && (
        <div className="tit-scroll min-h-0 flex-1 overflow-y-auto bg-[var(--tit-bg-1)]">
          {tab === 'brief' ? (
            <Section title="Weekly Intelligence">
              {weekly ? (
                <WeeklyBlock weekly={weekly} />
              ) : (
                <p className="text-[0.65rem] text-[var(--tit-text-1)]">Building brief…</p>
              )}
            </Section>
          ) : (
            <>
              {/* 1 VERDICT */}
              <section className="border-b border-[var(--tit-border)] px-2.5 py-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="tit-label">Verdict</p>
                    <p className="tit-mono text-[0.75rem] font-bold text-[var(--tit-text-0)]">
                      {focusSymbol || 'Select a token'}
                    </p>
                  </div>
                  {card?.sample ? <span className="tit-sample-tag">sample</span> : null}
                </div>

                {!focused ? (
                  <p className="text-[0.7rem] text-[var(--tit-text-1)]">
                    Focus a token in Discover to bind coach intelligence.
                  </p>
                ) : null}
                {scanning ? (
                  <div className="flex items-center gap-2 text-[0.7rem] text-[var(--tit-text-1)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Scanning via gateway…
                  </div>
                ) : null}
                {scanError ? (
                  <p className="text-[0.7rem] text-[var(--tit-neg)]" role="alert">
                    {scanError}
                  </p>
                ) : null}

                {card && !scanning ? (
                  <>
                    <div
                      className="mt-1 flex items-center gap-3 rounded-lg border px-3 py-3"
                      style={{
                        borderColor: VERDICT_STYLE[card.verdict].color,
                        boxShadow: `0 0 24px ${VERDICT_STYLE[card.verdict].glow}`,
                        background: `color-mix(in srgb, ${VERDICT_STYLE[card.verdict].color} 12%, transparent)`,
                      }}
                    >
                      <VerdictIcon verdict={card.verdict} />
                      <span
                        className="tit-mono text-2xl font-black tracking-wide"
                        style={{ color: VERDICT_STYLE[card.verdict].color }}
                      >
                        {VERDICT_STYLE[card.verdict].label}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <Metric label="Risk" value={card.riskScore != null ? String(card.riskScore) : null} />
                      <Metric
                        label="Coverage"
                        value={`${Math.round(card.evidence.coverage * 100)}%`}
                        caption={`${card.evidence.present.length}/${card.evidence.required.length}`}
                      />
                      <Metric label="Band" value={card.confidenceBand.toUpperCase()} />
                    </div>
                    <p className="mt-1 text-[0.5rem] text-[var(--tit-text-2)]">
                      Coverage = evidence present/required — not a precision confidence %.
                    </p>
                  </>
                ) : null}
              </section>

              {/* 2 WHY */}
              <Section title="Why" collapsed={!focused}>
                {evidenceBullets.length === 0 ? (
                  <p className="text-[0.65rem] text-[var(--tit-text-1)]">
                    No evidence bullets yet — await scan fields.
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

              {/* 3 ACTION */}
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
                    Awaiting verdict to form an action.
                  </p>
                )}
              </Section>

              {/* 4 TRADE PLAN */}
              <Section title="Trade Plan" collapsed={!focused}>
                {tradePlan.insufficient ? (
                  <p className="text-[0.65rem] text-[var(--tit-text-1)]">
                    Not enough scan inputs for a trade plan.
                  </p>
                ) : (
                  <dl className="grid grid-cols-1 gap-1.5 text-[0.7rem]">
                    <PlanRow label="Entry Zone" value={tradePlan.entryZone} />
                    <PlanRow
                      label="Risk Level"
                      value={tradePlan.riskLevel}
                      tone={
                        tradePlan.riskLevel === 'LOW'
                          ? 'pos'
                          : tradePlan.riskLevel === 'MEDIUM'
                            ? 'warn'
                            : 'neg'
                      }
                    />
                    <PlanRow label="Invalidation" value={tradePlan.invalidation} />
                    <div>
                      <dt className="tit-label !text-[9px]">Take Profit Targets</dt>
                      {tradePlan.takeProfitTargets.length === 0 ? (
                        <dd className="text-[var(--tit-text-2)]">
                          No mark price — targets omitted (not fabricated).
                        </dd>
                      ) : (
                        <dd className="tit-mono text-[var(--tit-pos)]">
                          {tradePlan.takeProfitTargets.join(' · ')}
                        </dd>
                      )}
                    </div>
                    <PlanRow label="Suggested Size" value={tradePlan.suggestedPositionSize} />
                  </dl>
                )}
              </Section>

              {/* 5 PORTFOLIO IMPACT */}
              <Section title="Portfolio Impact" collapsed={!focused}>
                {impact.awaiting ? (
                  <p className="text-[0.65rem] text-[var(--tit-text-1)]">
                    Connect wallet / load portfolio to project impact.
                  </p>
                ) : (
                  <>
                    <p className="tit-mono text-[0.75rem] text-[var(--tit-text-0)]">
                      {impact.metric}:{' '}
                      {impact.beforePct != null ? `${impact.beforePct.toFixed(1)}%` : '—'}
                      {impact.afterPct != null ? (
                        <>
                          {' '}
                          → <span className="text-[var(--tit-accent-bright)]">{impact.afterPct.toFixed(1)}%</span>
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

              {/* 6 SIMILAR SETUPS */}
              <Section title="Similar Setups" collapsed={!focused}>
                {!similarReady ? (
                  <p className="text-[0.7rem] text-[var(--tit-text-1)]">
                    Not enough historical evidence.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 tit-mono text-[0.7rem]">
                    <span>Found {similarReady.count}</span>
                    <span className="text-[var(--tit-pos)]">Avg {similarReady.avgOutcomePct}%</span>
                    <span>Win {similarReady.winRatePct}%</span>
                    <span>Hold {similarReady.avgHoldDays}d</span>
                  </div>
                )}
              </Section>

              {/* 7 WEEKLY */}
              <Section title="Weekly Intelligence">
                {weekly ? (
                  <WeeklyBlock weekly={weekly} />
                ) : (
                  <p className="text-[0.65rem] text-[var(--tit-text-1)]">Building brief…</p>
                )}
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
      {caption ? <p className="tit-mono text-[0.45rem] text-[var(--tit-text-2)]">{caption}</p> : null}
    </div>
  )
}

function PlanRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string | null
  tone?: 'pos' | 'warn' | 'neg'
}) {
  const color =
    tone === 'pos'
      ? 'text-[var(--tit-pos)]'
      : tone === 'warn'
        ? 'text-[var(--tit-warn)]'
        : tone === 'neg'
          ? 'text-[var(--tit-neg)]'
          : 'text-[var(--tit-text-0)]'
  return (
    <div>
      <dt className="tit-label !text-[9px]">{label}</dt>
      <dd className={`tit-mono ${color}`}>{value ?? '—'}</dd>
    </div>
  )
}

function WeeklyBlock({
  weekly,
}: {
  weekly: NonNullable<ReturnType<typeof loadWeeklyIntel>>
}) {
  return (
    <div className="space-y-1.5 rounded border border-[var(--tit-accent-2)]/30 bg-[var(--tit-bg-2)]/80 px-2 py-2">
      <p className="tit-mono text-[0.55rem] text-[var(--tit-accent-2)]">
        Week of {weekly.weekOf} · Brief #{weekly.briefNumber}
        {weekly.mockNarratives ? <span className="tit-sample-tag ml-1">sample</span> : null}
      </p>
      <Field label="Top Narrative" value={weekly.topNarrative} />
      <Field label="Smart Money Rotation" value={weekly.smartMoneyRotation} />
      <Field label="Highest Conviction Sector" value={weekly.convictionSector} />
      <Field label="Biggest Risk" value={weekly.biggestRisk} />
      <Field label="Coach Summary" value={weekly.summary} />
      {weekly.personalLines.length > 0 ? (
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

/** @deprecated Use IntelligenceColumn — kept for import compatibility. */
export { IntelligenceColumn as CoachRail }
