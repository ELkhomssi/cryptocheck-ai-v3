'use client'

import { useState } from 'react'
import type { OsBriefing, OsIntentId } from '../types'
import { useTerminalOsStore } from '@/stores/terminal-os'

export function DecisionActions({
  briefing,
  intent,
  onTaught,
}: {
  briefing: OsBriefing | null
  intent: OsIntentId | null
  onTaught?: () => void
}) {
  const setFocusedToken = useTerminalOsStore((s) => s.setFocusedToken)
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const [teaching, setTeaching] = useState(false)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const rec = briefing?.recommendation
  const canApprove = rec?.kind === 'opportunity' && Boolean(rec.symbol)

  const approve = () => {
    if (!rec?.symbol) return
    setFocusedToken({
      id: briefing?.decision?.subject.kind === 'token'
        ? briefing.decision.subject.address || rec.symbol
        : rec.symbol,
      symbol: rec.symbol,
      name: rec.symbol,
      chain: 'solana',
      priceUsd: 0,
    })
    setStatus(
      intent === 'protect'
        ? 'Approved for review under capital-protection routing.'
        : `Approved $${rec.symbol} — Decision ${rec.decisionId ?? ''} queued for your confirmation.`,
    )
  }

  const reject = () => {
    setStatus('Rejected. I will not surface this Decision again in this session.')
  }

  const teach = async () => {
    const text = note.trim()
    if (!text) {
      setTeaching(true)
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/terminal-os/trade-like-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'teach', note: text, wallet: wallet ?? undefined }),
      })
      if (!res.ok) throw new Error('Teach failed')
      setStatus('Teach note received — behavioral update queued (advise-only).')
      setNote('')
      setTeaching(false)
      onTaught?.()
    } catch {
      setStatus('Teach unavailable right now — try again shortly.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="aios-section" data-delay="4" aria-label="Decision actions">
      <p className="aios-section-label">Your move</p>
      <div className="aios-actions">
        <button
          type="button"
          className="aios-action"
          data-kind="approve"
          disabled={!canApprove}
          onClick={approve}
        >
          Approve
        </button>
        <button type="button" className="aios-action" data-kind="reject" onClick={reject}>
          Reject
        </button>
        <button
          type="button"
          className="aios-action"
          data-kind="teach"
          onClick={() => (teaching ? void teach() : setTeaching(true))}
          disabled={busy}
        >
          Teach AI
        </button>
      </div>
      {teaching ? (
        <div className="aios-teach">
          <label className="aios-empty" htmlFor="aios-teach-note">
            Describe your rule — never auto-execute from Teach.
          </label>
          <textarea
            id="aios-teach-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Never buy when whales are distributing."
          />
          <button
            type="button"
            className="aios-action"
            data-kind="teach"
            disabled={busy || !note.trim()}
            onClick={() => void teach()}
          >
            Submit teach note
          </button>
        </div>
      ) : null}
      {status ? <p className="aios-status">{status}</p> : null}
      {briefing?.provenance ? (
        <p className="aios-provenance">
          {briefing.provenance.source}
          {briefing.provenance.demo ? ' · sample fallback' : ''}
          {briefing.provenance.stale ? ' · stale' : ''}
          {' · '}
          {new Date(briefing.provenance.computedAt).toLocaleTimeString()}
        </p>
      ) : null}
    </section>
  )
}
