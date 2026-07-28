'use client'

import { useState } from 'react'
import { Activity, Brain, Shield, Sparkles, Waves } from 'lucide-react'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import { TraderDnaDashboard } from '@/features/terminal-os/ai-trade-like-me/components/TraderDnaDashboard'
import { PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { formatPct } from '@/features/terminal-os/shared/lib/format'
import type { TlmDecisionAction } from '@/features/terminal-os/ai-trade-like-me/types'

const ACTION_CLASS: Record<TlmDecisionAction, string> = {
  BUY: 'tos-tlm-act-buy',
  SELL: 'tos-tlm-act-sell',
  WAIT: 'tos-tlm-act-wait',
  EXIT: 'tos-tlm-act-exit',
  DO_NOTHING: 'tos-tlm-act-idle',
}

export function TradeLikeMeWidget({ compact = false }: { compact?: boolean }) {
  const {
    state,
    narrative,
    busy,
    error,
    trainAiFromMyTrading,
    refreshOpportunity,
    teach,
    setAutonomyEnabled,
    setCollectiveConsent,
    flags,
  } = useTradeLikeMeEngine()
  const [teachNote, setTeachNote] = useState('')

  return (
    <section
      className={`tos-tlm-widget${compact ? ' tos-tlm-widget--compact' : ''}`}
      aria-label="Trade Like Me"
    >
      <header className="tos-tlm-head">
        <div className="tos-tlm-brand">
          <span className="tos-tlm-orb" aria-hidden>
            <Brain size={16} />
          </span>
          <div>
            <h2 className="tos-tlm-title">Trade Like Me</h2>
            <p className="tos-tlm-sub">
              Personal AI trader · learns why you trade — never copies
            </p>
          </div>
        </div>
        <div className="tos-tlm-status-pill" data-phase={state.phase}>
          <span className="tos-tlm-pulse" aria-hidden />
          {state.statusLine}
        </div>
      </header>

      {/* Retention strip — always visible when DNA exists */}
      {state.dna ? (
        <div className="tos-tlm-invest-strip">
          <span>
            DNA Confidence <strong className="tos-num">{state.dna.confidence}%</strong>
          </span>
          <span className="tos-tlm-invest-sep" />
          <span>
            Sample size <strong className="tos-num">{state.dna.sampleSize}</strong>
            <span className="tos-muted">
              {' '}
              ({state.dna.tradeCount} trades · {state.dna.rejectionCount} rejections)
            </span>
          </span>
        </div>
      ) : null}

      <div className="tos-tlm-cta-row">
        <button
          type="button"
          className="tos-btn tos-btn-gold tos-tlm-train"
          disabled={busy}
          onClick={() => void trainAiFromMyTrading()}
        >
          <Sparkles size={14} />
          Train AI From My Trading
        </button>
        <button
          type="button"
          className="tos-btn tos-btn-ghost"
          disabled={busy || !state.dna}
          onClick={() => void refreshOpportunity()}
        >
          <Activity size={14} />
          Rescan Opportunity
        </button>
      </div>

      {error ? (
        <p className="tos-neg" style={{ fontSize: 'var(--tos-fs-sm)' }}>
          {error}
        </p>
      ) : null}

      <div className="tos-tlm-progress">
        <div className="tos-tlm-progress-meta">
          <span>Learning Progress</span>
          <span className="tos-num">{state.learningProgressPct}%</span>
        </div>
        <div className="tos-tlm-progress-bar">
          <div style={{ width: `${state.learningProgressPct}%` }} />
        </div>
        <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 6 }}>
          Analyzing: {state.analyzing.join(' · ')} · wallet read-only (no execute permission)
        </p>
      </div>

      {/* Performance Analytics — retention / autonomy proof */}
      {state.performance ? (
        <div className="tos-tlm-perf" data-sample={state.performance.sample ? 'true' : undefined}>
          <p className="tos-tlm-kicker">Performance Analytics</p>
          <p className="tos-tlm-perf-proof">{state.performance.proofLine}</p>
          <div className="tos-tlm-perf-grid">
            <span>
              AI ROI <strong className="tos-num">{formatPct(state.performance.aiFollowRoiPct)}</strong>
            </span>
            <span>
              Your baseline{' '}
              <strong className="tos-num">{formatPct(state.performance.traderBaselineRoiPct)}</strong>
            </span>
            <span>
              Alpha vs self{' '}
              <strong className="tos-num tos-pos">{formatPct(state.performance.alphaVsSelfPct)}</strong>
            </span>
            <span>
              Drawdown Δ{' '}
              <strong className="tos-num">−{state.performance.drawdownImprovementPct}%</strong>
            </span>
          </div>
          {state.performance.sample ? <span className="tos-wm-sample">sample model</span> : null}
        </div>
      ) : null}

      <div className="tos-tlm-body">
        <div className="tos-tlm-col">
          {busy && !state.dna ? (
            <PanelSkeleton rows={4} />
          ) : state.dna ? (
            <TraderDnaDashboard dna={state.dna} />
          ) : (
            <div className="tos-tlm-empty">
              <Waves size={20} />
              <p>Grant wallet read permission and train to build your Trader DNA.</p>
            </div>
          )}
        </div>

        <div className="tos-tlm-col tos-tlm-decision-col">
          <div
            className={`tos-tlm-card${state.currentOpportunity?.disagreement ? ' tos-tlm-card--disagree' : ''}`}
          >
            <p className="tos-tlm-kicker">Current Opportunity</p>
            {state.currentOpportunity && narrative ? (
              <>
                <div className="tos-tlm-decision-head">
                  <span
                    className={`tos-tlm-action ${ACTION_CLASS[state.currentOpportunity.action]}`}
                  >
                    {narrative.headline}
                  </span>
                  <span className="tos-tlm-conf">{narrative.confidenceLine}</span>
                </div>
                <p className="tos-tlm-token">
                  ${state.currentOpportunity.tokenSymbol}{' '}
                  <span className="tos-muted">{state.currentOpportunity.chain}</span>
                </p>
                <ul className="tos-tlm-reasons">
                  {narrative.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>

                {narrative.disagreementBlock ? (
                  <div className="tos-tlm-disagree" role="status">
                    <Shield size={16} />
                    <div>
                      <strong className="tos-tlm-disagree-title">AI Improves You</strong>
                      <p>{narrative.disagreementBlock}</p>
                      {state.currentOpportunity.disagreement?.marketDeviationCited.length ? (
                        <p className="tos-tlm-cite">
                          Cited:{' '}
                          {state.currentOpportunity.disagreement.marketDeviationCited.join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {narrative.citations.length ? (
                  <details className="tos-tlm-citations">
                    <summary>Score citations (inspectable)</summary>
                    <ul>
                      {narrative.citations.map((c, i) => (
                        <li key={`${c.field}-${i}`}>
                          <code>{c.source}.{c.field}</code> = {String(c.value)} — {c.contribution}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <div className="tos-tlm-expect">
                  <span>{narrative.upsideLine}</span>
                  <span>{narrative.downsideLine}</span>
                </div>
                <div className="tos-tlm-scores">
                  <Score label="Behavior" value={state.currentOpportunity.scores.behaviorMatch} />
                  <Score label="Market" value={state.currentOpportunity.scores.marketQuality} />
                  <Score label="Risk" value={state.currentOpportunity.scores.risk} />
                  <Score label="Timing" value={state.currentOpportunity.scores.timing} />
                </div>
              </>
            ) : (
              <p className="tos-muted">Train AI to score a live opportunity against your DNA.</p>
            )}
          </div>

          {state.collective && state.collectiveConsent.optedIn ? (
            <div className="tos-tlm-card tos-tlm-collective">
              <p className="tos-tlm-kicker">Collective Intelligence</p>
              <p style={{ fontSize: 'var(--tos-fs-sm)', margin: 0, lineHeight: 1.45 }}>
                {state.collective.similarDnaCount > 0 ? (
                  <>
                    Traders with DNA similar to yours ({state.collective.similarDnaCount} anonymized)
                    averaged{' '}
                    <strong className="tos-pos">
                      {formatPct(state.collective.avgOutcomePct)}
                    </strong>{' '}
                    on {state.collective.setupLabel} over {state.collective.holdWindowLabel}.
                  </>
                ) : (
                  <>Opted in — awaiting anonymized peer sample for this setup.</>
                )}
              </p>
            </div>
          ) : null}

          <div className="tos-tlm-card tos-tlm-grid-2">
            <div>
              <p className="tos-tlm-kicker">Current Position</p>
              <p className="tos-tlm-pos">
                {state.openPosition
                  ? `${state.openPosition.tokenSymbol} · ${formatPct(state.openPosition.unrealizedPnlPct)}`
                  : 'Flat'}
              </p>
            </div>
            <div>
              <p className="tos-tlm-kicker">Last Decision</p>
              <p className="tos-tlm-pos">
                {state.lastDecision ? state.lastDecision.summary : '—'}
              </p>
            </div>
            <div>
              <p className="tos-tlm-kicker">Expected ROI</p>
              <p className="tos-num">
                {state.currentOpportunity
                  ? formatPct(state.currentOpportunity.estimatedUpsidePct)
                  : '—'}
              </p>
            </div>
            <div>
              <p className="tos-tlm-kicker">Expected Risk</p>
              <p className="tos-num">
                {state.currentOpportunity
                  ? `−${state.currentOpportunity.estimatedDownsidePct}%`
                  : '—'}
              </p>
            </div>
          </div>

          <div className="tos-tlm-card">
            <p className="tos-tlm-kicker">Autonomous Mode</p>
            <label className="tos-tlm-auto-row">
              <input
                type="checkbox"
                checked={state.autonomy.config.enabled}
                onChange={(e) => setAutonomyEnabled(e.target.checked)}
              />
              <span>Arm Autonomous Mode (user config)</span>
            </label>
            <p
              className="tos-muted"
              style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 8, lineHeight: 1.45 }}
            >
              {state.autonomy.blockedReason ??
                (state.autonomy.wouldExecute
                  ? 'Would execute via risk-gated swap path'
                  : 'Monitoring only')}
              {!flags.autonomousTrading || !flags.realSwapExecution
                ? ' · Feature flags keep execution OFF'
                : null}
            </p>
            <p className="tos-tlm-next">
              Next action:{' '}
              <strong>
                {state.autonomy.plannedAction ?? state.currentOpportunity?.action ?? '—'}
              </strong>
            </p>
            {state.auditLog[0] ? (
              <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 6 }}>
                Audit: {state.auditLog[0].at.slice(11, 19)} · {state.auditLog[0].plannedAction} · DNA
                conf {state.auditLog[0].dnaSnapshot.confidence}%
              </p>
            ) : null}
          </div>

          <div className="tos-tlm-card">
            <p className="tos-tlm-kicker">Collective Intelligence (opt-in)</p>
            <label className="tos-tlm-auto-row">
              <input
                type="checkbox"
                checked={state.collectiveConsent.optedIn}
                onChange={(e) => setCollectiveConsent(e.target.checked)}
              />
              <span>Share anonymized style vectors (never wallet / trades)</span>
            </label>
          </div>

          <div className="tos-tlm-card">
            <p className="tos-tlm-kicker">Pause & Teach</p>
            <textarea
              className="tos-input"
              rows={2}
              placeholder='e.g. "I never hold through a 25% drawdown"'
              value={teachNote}
              onChange={(e) => setTeachNote(e.target.value)}
            />
            <button
              type="button"
              className="tos-btn tos-btn-ghost"
              style={{ marginTop: 8 }}
              disabled={!teachNote.trim()}
              onClick={() => {
                teach(teachNote.trim())
                setTeachNote('')
              }}
            >
              Teach the model
            </button>
          </div>
        </div>
      </div>

      {narrative ? (
        <p className="tos-muted tos-tlm-footer">{narrative.footer}</p>
      ) : (
        <p className="tos-muted tos-tlm-footer">Not financial advice · DYOR</p>
      )}
    </section>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="tos-tlm-score">
      <span>{label}</span>
      <div className="tos-tlm-score-bar">
        <i style={{ width: `${value}%` }} />
      </div>
      <span className="tos-num">{value}</span>
    </div>
  )
}
