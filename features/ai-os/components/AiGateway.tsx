'use client'

/**
 * AI Gateway — primary workspace.
 * The OS already knows portfolio, risk, opportunity, rotation, scanner, DNA.
 * User only approves. Execution is the last step.
 */

import { useMemo, useState } from 'react'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { formatPct } from '@/lib/portfolio-desk/format'
import type { MissionViewModel } from '@/types/intelligence-core'
import type { Holding } from '@/types/portfolio-desk'
import type { PortfolioHealthSummary } from '@/features/terminal-os/shared/types'
import type { GatewayPhase } from '../types'
import { GatewayExecution } from './GatewayExecution'

export function AiGateway({
  mission,
  loading,
  summary,
  worst,
  onAskCoach,
}: {
  mission: MissionViewModel | null
  loading: boolean
  summary: PortfolioHealthSummary | null
  worst: Holding | null
  onAskCoach: (prompt: string) => void
}) {
  const { state, refreshOpportunity, busy } = useTradeLikeMeEngine()
  const setFocusedToken = useTerminalOsStore((s) => s.setFocusedToken)
  const [phase, setPhase] = useState<GatewayPhase>('briefing')
  const [rejected, setRejected] = useState(false)

  const opp = state.currentOpportunity
  const narrative = useMemo(() => (opp ? explainDecision(opp) : null), [opp])
  const groundedRec = mission?.recommendations?.find((r) => r.grounded) ?? mission?.recommendations?.[0]

  const dnaReady = Boolean(state.dna && state.dna.sampleSize >= 3)
  const dnaMatch =
    opp && dnaReady && typeof opp.scores?.behaviorMatch === 'number'
      ? Math.round(opp.scores.behaviorMatch)
      : opp && typeof opp.scores?.confidence === 'number'
        ? Math.round(opp.scores.confidence)
        : null

  const briefTitle = mission?.dailyBrief?.title || 'Operating brief'
  const briefBody =
    mission?.dailyBrief?.body ||
    (loading
      ? 'Assembling live intelligence…'
      : 'Monitoring markets. Connect a wallet for portfolio-aware decisions.')

  const onApprove = () => {
    setRejected(false)
    if (opp) {
      setFocusedToken({
        id: opp.tokenSymbol,
        symbol: opp.tokenSymbol,
        name: opp.tokenSymbol,
        chain: opp.chain === 'all' ? 'solana' : opp.chain,
        priceUsd: 0,
      })
    }
    setPhase('execute')
    onAskCoach(
      `I approved the gateway recommendation${opp ? ` on $${opp.tokenSymbol}` : ''}. Explain confidence, risks, and alternatives before I sign.`,
    )
  }

  const onReject = () => {
    setPhase('idle')
    setRejected(true)
    onAskCoach(
      `I rejected the current recommendation${opp ? ` on $${opp.tokenSymbol}` : ''}. Why might that be wise, and what is the next alternative?`,
    )
  }

  return (
    <section className="aios-gateway" aria-label="AI Gateway">
      <div className="aios-gateway-head">
        <p className="aios-kicker">AI Gateway</p>
        <h2 className="aios-gateway-title">{briefTitle}</h2>
        <p className="aios-gateway-body">{briefBody}</p>
      </div>

      <div className="aios-knows" aria-label="What the OS already knows">
        <Know
          label="Portfolio"
          value={summary ? `${Math.round(summary.totalAssetsUsd).toLocaleString()} USD` : '—'}
        />
        <Know label="Risk" value={summary ? `${summary.aiHealthScore}/100` : '—'} />
        <Know
          label="Best opportunity"
          value={opp ? `$${opp.tokenSymbol}` : groundedRec?.title?.slice(0, 28) || 'Scanning'}
        />
        <Know
          label="Worst position"
          value={worst ? `$${worst.symbol} ${formatPct(worst.change24hPct)}` : '—'}
        />
        <Know
          label="Expected ROI"
          value={
            opp?.estimatedUpsidePct != null && Number.isFinite(opp.estimatedUpsidePct)
              ? `+${opp.estimatedUpsidePct.toFixed(1)}%`
              : '—'
          }
        />
        <Know
          label="DNA match"
          value={dnaMatch != null ? `${dnaMatch}%` : dnaReady ? 'Waiting' : 'Train DNA'}
        />
      </div>

      <article className="aios-rec">
        <p className="aios-kicker">Today&apos;s recommendation</p>
        {opp && narrative ? (
          <>
            <h3 className="aios-rec-headline">
              {narrative.headline} ${opp.tokenSymbol}
              {dnaMatch != null ? ` · ${dnaMatch}% DNA match` : ''}
            </h3>
            <p className="aios-rec-why">
              {narrative.confidenceLine}. {narrative.bullets[0] ?? narrative.upsideLine}
            </p>
            {narrative.disagreementBlock ? (
              <p className="aios-warn">Warning: {narrative.disagreementBlock}</p>
            ) : null}
            <p className="aios-muted">
              {narrative.upsideLine} · {narrative.downsideLine}
            </p>
          </>
        ) : groundedRec ? (
          <>
            <h3 className="aios-rec-headline">{groundedRec.title}</h3>
            <p className="aios-rec-why">{groundedRec.explanation}</p>
            {!groundedRec.grounded ? (
              <p className="aios-muted">Not fully grounded — treating as provisional.</p>
            ) : null}
          </>
        ) : (
          <p className="aios-muted">
            {loading ? 'Ranking opportunities…' : 'No high-conviction recommendation yet.'}
          </p>
        )}

        {mission?.running?.length ? (
          <p className="aios-muted aios-running">
            Live: {mission.running[0]!.description}
            {mission.running.length > 1 ? ` · +${mission.running.length - 1}` : ''}
          </p>
        ) : null}

        {rejected ? (
          <p className="aios-status">Rejected — Coach will propose alternatives. Nothing executed.</p>
        ) : null}

        <div className="aios-gateway-actions">
          <button
            type="button"
            className="aios-btn aios-btn-primary"
            disabled={phase === 'execute' || (!opp && !groundedRec)}
            onClick={onApprove}
          >
            Approve
          </button>
          <button
            type="button"
            className="aios-btn aios-btn-ghost"
            disabled={!opp && !groundedRec}
            onClick={onReject}
          >
            Reject
          </button>
          <button
            type="button"
            className="aios-btn aios-btn-ghost"
            disabled={busy}
            onClick={() => void refreshOpportunity()}
          >
            Refresh
          </button>
        </div>
      </article>

      {phase === 'execute' ? (
        <div className="aios-exec-wrap">
          <p className="aios-kicker">Execution — last step</p>
          <p className="aios-muted">
            Non-custodial. Simulate before send. Your wallet signs — the OS never holds keys.
          </p>
          <GatewayExecution />
        </div>
      ) : null}
    </section>
  )
}

function Know({ label, value }: { label: string; value: string }) {
  return (
    <div className="aios-know">
      <span className="aios-know-label">{label}</span>
      <span className="aios-know-value">{value}</span>
    </div>
  )
}
