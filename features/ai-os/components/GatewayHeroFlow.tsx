'use client'

/**
 * AI Gateway hero — Decision-first card (mockup hierarchy).
 * Presentation only. All numbers from Decision / DNA; missing → Unavailable.
 * Primary CTA: Approve & Execute · Secondary: Simulate / Sign / Queue (safety floor visible).
 */

import type { Decision } from '@cryptocheck/decision-contracts'
import { Sparkline } from '@/features/terminal-os/shared/components/Sparkline'
import {
  buildGatewayGreeting,
  buildHeroMetrics,
  canShowConfidenceTrend,
  confidenceSeries,
  convictionBadgeLabel,
  decisionAgeLabel,
  decisionFreshnessLabel,
  engineChecklist,
  engineStatusMark,
  heroReason,
  type GatewayHistoryPoint,
} from '@/features/ai-os/lib/gateway-round2'
import type { DecisionTickMeta } from '@/features/ai-os/lib/gateway-phase'

function EngineChecklist({
  engines,
  decisionReady,
  decisionLoading,
}: {
  engines: ReturnType<typeof engineChecklist>
  decisionReady: boolean
  decisionLoading: boolean
}) {
  return (
    <ul className="aios-gw-sources" aria-label="Engine status" data-gw-engines="true">
      {engines.map((e) => (
        <li key={e.id}>
          <strong>{e.label}</strong>
          <span>
            {e.status === 'unavailable'
              ? 'unavailable'
              : e.status === 'loading'
                ? 'loading'
                : 'ready'}
          </span>
          <span aria-label={e.status}>{engineStatusMark(e.status)}</span>
        </li>
      ))}
      <li>
        <strong>Decision</strong>
        <span>{decisionReady ? 'ready' : decisionLoading ? 'loading' : 'waiting'}</span>
        <span>{decisionReady ? '✓' : decisionLoading ? '…' : '—'}</span>
      </li>
    </ul>
  )
}

function MetricGrid({
  cells,
  compact,
  'data-gw-mission': gwMission,
  'data-gw-secondary': gwSecondary,
}: {
  cells: ReturnType<typeof buildHeroMetrics>['primary']
  compact?: boolean
  'data-gw-mission'?: string
  'data-gw-secondary'?: string
}) {
  return (
    <div
      className="aios-gw-metrics"
      data-compact={compact ? 'true' : undefined}
      data-cols={cells.length}
      data-gw-mission={gwMission}
      data-gw-secondary={gwSecondary}
    >
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="aios-gw-metric"
          data-available={cell.available ? 'true' : 'false'}
          title={cell.hint}
        >
          <span className="aios-gw-metric-label">{cell.label}</span>
          <span className="aios-gw-metric-value">{cell.value}</span>
        </div>
      ))}
    </div>
  )
}

export function GatewayHeroFlow({
  displayName,
  tickMeta,
  portfolioReviewed,
  decision,
  decisionLoading,
  history,
  avgHoldingMs,
  dnaSampleSize,
  tradingStyleSummary,
  missionApproved,
  onApproveAndExecute,
  onSimulate,
  onSign,
  simulateBusy,
  signBusy,
  simReady,
  evidenceOpen,
  onEvidenceToggle,
  dir,
  subjectSymbol,
}: {
  displayName: string | null
  tickMeta: DecisionTickMeta | null
  portfolioReviewed: boolean
  decision: Decision | null
  decisionLoading: boolean
  history: GatewayHistoryPoint[] | null
  avgHoldingMs: number | null
  dnaSampleSize: number | null
  tradingStyleSummary: string | null
  missionApproved: boolean
  onApproveAndExecute: () => void
  onSimulate: () => void
  onSign: () => void
  simulateBusy: boolean
  signBusy: boolean
  /** True after a successful dry-run simulation (Sign may proceed). */
  simReady: boolean
  evidenceOpen: boolean
  onEvidenceToggle: (open: boolean) => void
  dir: 'bullish' | 'bearish' | 'neutral'
  subjectSymbol?: string
}) {
  const greeting = buildGatewayGreeting({
    displayName,
    tickMeta,
    portfolioReviewed,
  })
  const engines = engineChecklist({ decisionLoading, decision })
  const series = confidenceSeries(history)
  const showTrend = canShowConfidenceTrend(series)
  const decisionReady = Boolean(decision && !decisionLoading)
  const showEnginesWhileComputing = decisionLoading || !decision
  const conviction = decision ? convictionBadgeLabel(decision.confidence) : null
  const metrics = decision
    ? buildHeroMetrics(decision, {
        avgHoldingMs,
        dnaSampleSize,
        tradingStyleSummary,
      })
    : null

  return (
    <div
      className="aios-gw-decision"
      data-degraded={decision?.degraded ? 'true' : 'false'}
      data-phase={decisionReady ? 'ready' : decisionLoading ? 'thinking' : 'waiting'}
      aria-live="polite"
    >
      <div className="aios-gw-spoken" data-gw-greeting="true">
        {greeting.lines.map((line, i) => (
          <p key={`${i}-${line.slice(0, 24)}`} className="aios-gw-reasoning">
            {line}
          </p>
        ))}
      </div>

      {showEnginesWhileComputing ? (
        <EngineChecklist
          engines={engines}
          decisionReady={false}
          decisionLoading={decisionLoading}
        />
      ) : (
        <p className="aios-gw-thinking" data-live="false" data-gw-ready-line="true">
          Decision Ready
          {decision
            ? ` · ${decisionAgeLabel(decision.computedAt)} · ${decisionFreshnessLabel(decision.staleAfter)}`
            : ''}
        </p>
      )}

      {decisionLoading && !decision ? (
        <p className="aios-gw-reasoning">Loading Decision…</p>
      ) : decision && metrics ? (
        <>
          <div className="aios-gw-badges" data-gw-badges="true">
            <span className="aios-gw-badge" data-kind="primary">
              Primary Decision
            </span>
            {conviction ? (
              <span className="aios-gw-badge" data-kind="conviction" data-gw-conviction="true">
                {conviction}
              </span>
            ) : null}
          </div>

          <h3 className="aios-gw-action" data-dir={dir} data-gw-hero-decision="true">
            {decision.action}
            {subjectSymbol ? ` $${subjectSymbol}` : ''}
          </h3>

          <p className="aios-gw-reasoning" data-gw-hero-reason="true">
            {heroReason(decision.reasoning)}
          </p>

          <MetricGrid cells={metrics.primary} data-gw-mission="true" />
          <MetricGrid cells={metrics.secondary} compact data-gw-secondary="true" />

          <div className="aios-gw-cta" data-gw-cta="true">
            <button
              type="button"
              className="aios-swap-execute aios-gw-cta-primary"
              data-gw-approve="true"
              onClick={onApproveAndExecute}
            >
              {missionApproved ? 'Approve & Execute »' : 'Approve & Execute »'}
            </button>
            <div className="aios-gw-cta-secondary" role="group" aria-label="Execution safety steps">
              <button
                type="button"
                className="aios-gw-cta-sec"
                data-gw-simulate="true"
                disabled={!missionApproved || simulateBusy}
                onClick={onSimulate}
                title={
                  missionApproved
                    ? 'Dry-run on RPC — no wallet signature'
                    : 'Approve first to unlock Simulate'
                }
              >
                {simulateBusy ? 'Simulating…' : 'Simulate'}
              </button>
              <button
                type="button"
                className="aios-gw-cta-sec"
                data-gw-sign="true"
                disabled={!missionApproved || !simReady || signBusy}
                onClick={onSign}
                title={
                  simReady
                    ? 'Your wallet signs — OS never holds keys'
                    : 'Run Simulate successfully before Sign'
                }
              >
                {signBusy ? 'Signing…' : 'Sign'}
              </button>
              <button
                type="button"
                className="aios-gw-cta-sec"
                data-gw-queue="true"
                disabled
                title="Queue unavailable — no execution queue engine in this build"
              >
                Queue
              </button>
            </div>
            {missionApproved ? (
              <p className="aios-gw-thinking" data-live="true">
                Approved — review cost below, then Simulate → Sign
              </p>
            ) : (
              <p className="aios-gw-thinking" data-live="false">
                Approve unlocks Simulate / Sign. Queue not enabled.
              </p>
            )}
          </div>

          <details
            className="aios-gw-sources-wrap"
            open={evidenceOpen}
            onToggle={(e) => onEvidenceToggle((e.target as HTMLDetailsElement).open)}
          >
            <summary>Evidence / Details</summary>

            <div className="aios-gw-confidence" data-gw-freshness="true">
              <span className="aios-gw-confidence-value">{Math.round(decision.confidence)}%</span>
              <span className="aios-gw-confidence-meta">
                {decision.confidenceMode === 'personalized' ? 'Personalized' : 'Market'}
                {' · '}
                {decisionAgeLabel(decision.computedAt)}
                {' · '}
                {decisionFreshnessLabel(decision.staleAfter)}
              </span>
              {showTrend ? (
                <span aria-label="Confidence trend">
                  <Sparkline values={series.slice(-12)} width={72} height={22} />
                </span>
              ) : (
                <span className="aios-gw-confidence-meta">Building confidence history</span>
              )}
            </div>

            <p className="aios-gw-confidence-meta">
              market {Math.round(decision.marketConfidence)}%
              {decision.personalizedConfidence != null
                ? ` · DNA ${Math.round(decision.personalizedConfidence)}%`
                : ''}
              {decision.expectedDrawdown != null
                ? ` · DD ${decision.expectedDrawdown.toFixed(1)}%`
                : ''}
            </p>

            <EngineChecklist
              engines={engines}
              decisionReady={decisionReady}
              decisionLoading={decisionLoading}
            />

            {decision.contributingFactors.length > 0 ? (
              <ul className="aios-gw-sources" aria-label="AI sources">
                {decision.contributingFactors.slice(0, 5).map((f, i) => (
                  <li key={`${f.engine}-${i}`}>
                    <strong>{String(f.engine)}</strong>
                    <span>{f.summary}</span>
                    <span>{Math.round(f.weight * 100)}%</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {decision.degraded ? (
              <span className="aios-swap-degraded">degraded inputs</span>
            ) : null}
          </details>
        </>
      ) : (
        <p className="aios-gw-reasoning">No Decision published yet.</p>
      )}
    </div>
  )
}
