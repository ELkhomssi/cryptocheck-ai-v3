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
    flags,
  } = useTradeLikeMeEngine()
  const [teachNote, setTeachNote] = useState('')

  return (
    <section className={`tos-tlm-widget${compact ? ' tos-tlm-widget--compact' : ''}`} aria-label="Trade Like Me">
      <header className="tos-tlm-head">
        <div className="tos-tlm-brand">
          <span className="tos-tlm-orb" aria-hidden>
            <Brain size={16} />
          </span>
          <div>
            <h2 className="tos-tlm-title">Trade Like Me</h2>
            <p className="tos-tlm-sub">Personal AI trader · learns why you trade — never copies</p>
          </div>
        </div>
        <div className="tos-tlm-status-pill" data-phase={state.phase}>
          <span className="tos-tlm-pulse" aria-hidden />
          {state.statusLine}
        </div>
      </header>

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

      {error ? <p className="tos-neg" style={{ fontSize: 'var(--tos-fs-sm)' }}>{error}</p> : null}

      <div className="tos-tlm-progress">
        <div className="tos-tlm-progress-meta">
          <span>Learning Progress</span>
          <span className="tos-num">{state.learningProgressPct}%</span>
        </div>
        <div className="tos-tlm-progress-bar">
          <div style={{ width: `${state.learningProgressPct}%` }} />
        </div>
        <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 6 }}>
          Analyzing: {state.analyzing.join(' · ')}
        </p>
      </div>

      <div className="tos-tlm-body">
        <div className="tos-tlm-col">
          {busy && !state.dna ? (
            <PanelSkeleton rows={4} />
          ) : state.dna ? (
            <TraderDnaDashboard dna={state.dna} />
          ) : (
            <div className="tos-tlm-empty">
              <Waves size={20} />
              <p>Connect wallet permission and train to build your Trader DNA.</p>
            </div>
          )}
        </div>

        <div className="tos-tlm-col tos-tlm-decision-col">
          <div className="tos-tlm-card">
            <p className="tos-tlm-kicker">Current Opportunity</p>
            {state.currentOpportunity && narrative ? (
              <>
                <div className="tos-tlm-decision-head">
                  <span className={`tos-tlm-action ${ACTION_CLASS[state.currentOpportunity.action]}`}>
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
                  <div className="tos-tlm-disagree">
                    <Shield size={14} />
                    <p>{narrative.disagreementBlock}</p>
                  </div>
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
            <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', marginTop: 8, lineHeight: 1.45 }}>
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
              <strong>{state.autonomy.plannedAction ?? state.currentOpportunity?.action ?? '—'}</strong>
            </p>
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
