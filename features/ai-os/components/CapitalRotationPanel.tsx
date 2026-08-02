'use client'

/**
 * Capital Rotation — loss-discipline proposals.
 * Advise-only by default. Exit losses shown plainly. Never claims zero losses.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type {
  RotationAggregateStats,
  RotationEvent,
  RotationProposal,
  RotationThreshold,
} from '@/features/terminal-os/capital-rotation/types'

type RotationPayload = {
  threshold: RotationThreshold
  proposal: RotationProposal | null
  events: RotationEvent[]
  aggregate: RotationAggregateStats
  honestyNote: string
  permissionDefault: string
}

export function CapitalRotationPanel({
  onRotateInto,
}: {
  onRotateInto?: (mint: string, symbol: string) => void
}) {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const [data, setData] = useState<RotationPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thresholdInput, setThresholdInput] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!wallet) {
      setData(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/terminal-os/rotation?wallet=${encodeURIComponent(wallet)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Rotation status unavailable')
      const body = (await res.json()) as RotationPayload
      setData(body)
      setThresholdInput(String(body.threshold.thresholdPct))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unavailable')
    } finally {
      setLoading(false)
    }
  }, [wallet])

  useEffect(() => {
    void load()
  }, [load])

  const evaluate = async () => {
    if (!wallet) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/terminal-os/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, action: 'evaluate', permissionMode: 'advise_only' }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Evaluate failed')
      setStatus(
        body.proposal
          ? 'Rotation proposed — review both legs. Advise-only: nothing executes until you approve and sign.'
          : body.skippedReason === 'no_genuine_deterioration'
            ? 'No genuine deterioration — ordinary volatility will not force an exit.'
            : body.skippedReason === 'no_open_positions'
              ? 'No open token positions to monitor.'
              : body.skippedReason === 'proposal_pending_user'
                ? 'A proposal is already waiting for your decision.'
                : `No proposal (${body.skippedReason ?? 'none'}).`,
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluate failed')
    } finally {
      setBusy(false)
    }
  }

  const setThreshold = async () => {
    if (!wallet) return
    const n = Number(thresholdInput)
    if (!Number.isFinite(n)) return
    setBusy(true)
    try {
      const res = await fetch('/api/terminal-os/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, action: 'set_threshold', thresholdPct: n }),
      })
      if (!res.ok) throw new Error('Could not update threshold')
      setStatus('Loss threshold updated by you — the autonomous system cannot change this.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Threshold update failed')
    } finally {
      setBusy(false)
    }
  }

  const respond = async (action: 'approve' | 'reject') => {
    if (!wallet) return
    setBusy(true)
    try {
      const res = await fetch('/api/terminal-os/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, action }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed')
      if (action === 'approve' && body.event) {
        setStatus(
          `Logged linked rotation. Next: execute EXIT $${body.event.exit.symbol} then BUY $${body.event.entry.symbol} in Intelligence Swap — your wallet signs both legs.`,
        )
        onRotateInto?.(body.event.entry.mint, body.event.entry.symbol)
      } else {
        setStatus('Proposal rejected — position left untouched.')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="aios-section aios-rotation" data-delay="2" aria-label="Capital rotation">
      <p className="aios-section-label">Loss discipline · Capital rotation</p>
      <p className="aios-rotation-claim">
        The AI exits a weakening position before it becomes a big loss, then puts that capital toward
        current strength. Exit legs may still be real losses versus entry — never zero-loss.
      </p>

      {!wallet ? (
        <p className="aios-empty">Connect a wallet to monitor positions against your loss threshold.</p>
      ) : loading && !data ? (
        <p className="aios-empty">Loading rotation status…</p>
      ) : error && !data ? (
        <p className="aios-empty">{error}</p>
      ) : data ? (
        <>
          <div className="aios-rotation-threshold">
            <div>
              <span className="aios-market-label">Loss threshold</span>
              <div className="aios-rotation-threshold-row">
                <input
                  className="aios-rotation-input"
                  type="number"
                  min={1}
                  max={40}
                  step={0.5}
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  aria-label="Loss threshold percent"
                />
                <span className="aios-muted">%</span>
                <button
                  type="button"
                  className="aios-action"
                  data-kind="teach"
                  disabled={busy}
                  onClick={() => void setThreshold()}
                >
                  Save
                </button>
              </div>
              <p className="aios-provenance">
                Source:{' '}
                {data.threshold.source === 'trader_dna'
                  ? 'Trader DNA loss tolerance (personalized)'
                  : data.threshold.source === 'user'
                    ? 'Your override'
                    : 'Conservative default — not personalized'}
                {data.threshold.personalized ? '' : ' · train Trade Like Me for DNA-derived threshold'}
              </p>
            </div>
            <button
              type="button"
              className="aios-action"
              data-kind="approve"
              disabled={busy}
              onClick={() => void evaluate()}
            >
              Evaluate now
            </button>
          </div>

          {data.proposal?.status === 'proposed' ? (
            <article className="aios-rotation-proposal">
              <h3 className="aios-rec-headline">Proposed rotation (advise only)</h3>
              <div className="aios-rotation-legs">
                <div className="aios-rotation-leg" data-leg="exit">
                  <span className="aios-market-label">Exit</span>
                  <p>
                    Exited ${data.proposal.exit.symbol} —{' '}
                    <strong>
                      {data.proposal.exit.pnlPctFromEntry >= 0 ? '+' : ''}
                      {data.proposal.exit.pnlPctFromEntry}% from entry
                    </strong>
                  </p>
                  <p className="aios-rec-detail">
                    Reason: {data.proposal.exit.deteriorationReasons.join(', ')}
                  </p>
                </div>
                <div className="aios-rotation-leg" data-leg="entry">
                  <span className="aios-market-label">Rotate into</span>
                  <p>
                    ${data.proposal.entry.symbol} — Decision confidence{' '}
                    {data.proposal.entry.decision.marketConfidence ??
                      data.proposal.entry.decision.confidence}
                    %
                  </p>
                  <p className="aios-rec-detail">
                    Reason: {data.proposal.entry.decision.reasoning.slice(0, 180)}
                  </p>
                  <p className="aios-provenance">
                    Security gate: {data.proposal.entry.securityVerdict}
                    {data.proposal.entry.securityPassed ? ' · passed' : ' · blocked'}
                  </p>
                </div>
              </div>
              <p className="aios-status">{data.proposal.honestyNote}</p>
              <div className="aios-actions" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="aios-action"
                  data-kind="approve"
                  disabled={busy}
                  onClick={() => void respond('approve')}
                >
                  Approve (then sign in Swap)
                </button>
                <button
                  type="button"
                  className="aios-action"
                  data-kind="reject"
                  disabled={busy}
                  onClick={() => void respond('reject')}
                >
                  Reject
                </button>
              </div>
            </article>
          ) : null}

          {data.events.length > 0 ? (
            <div className="aios-rotation-log">
              <p className="aios-section-label">Linked rotation log</p>
              <ul className="aios-coach-lines">
                {data.events.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    Exited ${e.exit.symbol} —{' '}
                    <strong>
                      {e.exitResultPct >= 0 ? '+' : ''}
                      {e.exitResultPct}% from entry
                    </strong>
                    <br />
                    <span className="aios-muted">Reason: {e.exit.reason}</span>
                    <br />
                    Rotated into ${e.entry.symbol} — Decision confidence {e.entry.confidence}%
                    <br />
                    <span className="aios-muted">Reason: {e.entry.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="aios-rotation-agg">
            <p className="aios-section-label">Aggregate rotation strategy</p>
            <p className="aios-rec-meta">
              Events {data.aggregate.eventCount}
              {data.aggregate.avgExitResultPct != null
                ? ` · avg exit ${data.aggregate.avgExitResultPct}%`
                : ''}
              {` · loss exits ${data.aggregate.lossExitCount}`}
              {data.aggregate.aggregateNetPct != null
                ? ` · measured net ${data.aggregate.aggregateNetPct}%`
                : ' · measured net — (need ≥3 paired results)'}
            </p>
            <p className="aios-status">{data.aggregate.honestyNote}</p>
          </div>
        </>
      ) : null}

      {status ? <p className="aios-status">{status}</p> : null}
      {error && data ? <p className="aios-status">{error}</p> : null}
    </section>
  )
}
