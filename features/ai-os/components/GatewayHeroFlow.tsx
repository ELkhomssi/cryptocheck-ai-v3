'use client'

/**
 * AI Gateway hero — Decision → Reason → Approve (Mission Summary) → Execute cue.
 * Presentation / IA only. Reuses existing aios-gw-* classes (no Round 1 visual retune).
 */

import type { Decision } from '@cryptocheck/decision-contracts'
import { Sparkline } from '@/features/terminal-os/shared/components/Sparkline'
import {
  buildGatewayGreeting,
  buildMissionSummary,
  canShowConfidenceTrend,
  confidenceSeries,
  decisionAgeLabel,
  decisionFreshnessLabel,
  engineChecklist,
  engineStatusMark,
  heroReason,
  type GatewayHistoryPoint,
} from '@/features/ai-os/lib/gateway-round2'
import type { DecisionTickMeta } from '@/features/ai-os/lib/gateway-phase'

export function GatewayHeroFlow({
  displayName,
  tickMeta,
  portfolioReviewed,
  decision,
  decisionLoading,
  history,
  avgHoldingMs,
  missionApproved,
  onApprove,
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
  missionApproved: boolean
  onApprove: () => void
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
  const mission = decision
    ? buildMissionSummary(decision, { avgHoldingMs })
    : null

  return (
    <div
      className="aios-gw-decision"
      data-degraded={decision?.degraded ? 'true' : 'false'}
      data-phase={decision && !decisionLoading ? 'ready' : decisionLoading ? 'thinking' : 'waiting'}
      aria-live="polite"
    >
      {/* §1 Proactive greeting */}
      <div className="aios-gw-spoken" data-gw-greeting="true">
        {greeting.lines.map((line, i) => (
          <p key={`${i}-${line.slice(0, 24)}`} className="aios-gw-reasoning">
            {line}
          </p>
        ))}
      </div>

      {/* §5 Per-engine real progress */}
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
          <span>
            {decision && !decisionLoading ? 'ready' : decisionLoading ? 'loading' : 'waiting'}
          </span>
          <span>{decision && !decisionLoading ? '✓' : decisionLoading ? '…' : '—'}</span>
        </li>
      </ul>

      {decisionLoading && !decision ? (
        <p className="aios-gw-reasoning">Loading Decision…</p>
      ) : decision && mission ? (
        <>
          {/* §2–3 Hero: Decision → Reason → Approve → (Execute below in parent) */}
          <h3 className="aios-gw-action" data-dir={dir} data-gw-hero-decision="true">
            {decision.action}
            {subjectSymbol ? ` $${subjectSymbol}` : ''}
          </h3>

          <p className="aios-gw-reasoning" data-gw-hero-reason="true">
            {heroReason(decision.reasoning)}
          </p>

          {/* §4 Confidence age / freshness / trend */}
          <div className="aios-gw-confidence" data-gw-freshness="true">
            <span className="aios-gw-confidence-value">{Math.round(decision.confidence)}%</span>
            <span className="aios-gw-confidence-meta">
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

          {/* §6 Mission Summary → Approve */}
          <div className="aios-gw-metrics" data-compact="true" data-gw-mission="true">
            <div className="aios-gw-metric">
              <span className="aios-gw-metric-label">Action</span>
              <span className="aios-gw-metric-value">{mission.actionLine}</span>
            </div>
            <div className="aios-gw-metric">
              <span className="aios-gw-metric-label">Reason</span>
              <span className="aios-gw-metric-value">{mission.reason}</span>
            </div>
            <div className="aios-gw-metric">
              <span className="aios-gw-metric-label">Risk</span>
              <span className="aios-gw-metric-value">
                {mission.risk} ({Math.round(decision.risk)})
              </span>
            </div>
            {mission.expectedRoi != null ? (
              <div className="aios-gw-metric">
                <span className="aios-gw-metric-label">Expected ROI</span>
                <span className="aios-gw-metric-value">{mission.expectedRoi}</span>
              </div>
            ) : null}
            {mission.holding != null ? (
              <div className="aios-gw-metric">
                <span className="aios-gw-metric-label">Holding</span>
                <span className="aios-gw-metric-value">{mission.holding}</span>
              </div>
            ) : null}
          </div>

          {!missionApproved ? (
            <button
              type="button"
              className="aios-swap-override"
              data-gw-approve="true"
              onClick={onApprove}
            >
              Approve
            </button>
          ) : (
            <p className="aios-gw-thinking" data-live="true">
              Approved — review cost, then Execute
            </p>
          )}

          <details
            className="aios-gw-sources-wrap"
            open={evidenceOpen}
            onToggle={(e) => onEvidenceToggle((e.target as HTMLDetailsElement).open)}
          >
            <summary>Evidence / Details</summary>
            <p className="aios-gw-confidence-meta">
              {decision.confidenceMode === 'personalized' ? 'Personalized' : 'Market'} confidence
              {' · '}
              market {Math.round(decision.marketConfidence)}%
              {decision.personalizedConfidence != null
                ? ` · DNA ${Math.round(decision.personalizedConfidence)}%`
                : ''}
              {decision.expectedDrawdown != null
                ? ` · DD ${decision.expectedDrawdown.toFixed(1)}%`
                : ''}
            </p>
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
