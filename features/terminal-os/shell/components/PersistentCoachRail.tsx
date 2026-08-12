'use client'

/**
 * Persistent right-rail AI Coach — mockup placement.
 * Bullets only from real Decision.contributingFactors / reasoning / DNA.
 * Never invents "SOL is #1" style copy without a published Decision.
 */

import { useQuery } from '@tanstack/react-query'
import type { Decision } from '@cryptocheck/decision-contracts'
import { CoachPanel } from '@/components/portfolio-desk/coach/CoachPanel'
import { PanelErrorBoundary } from '@/features/terminal-os/shared/components/PanelErrorBoundary'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { selectHeroDecision } from '@/features/ai-os/lib/gateway-round2'

type CoachBullet = {
  id: string
  text: string
  source: 'decision' | 'factor' | 'dna'
}

function bulletsFromDecision(d: Decision): CoachBullet[] {
  const out: CoachBullet[] = []
  const symbol = d.subject.kind === 'token' ? d.subject.symbol : null
  out.push({
    id: `${d.id}-action`,
    text: symbol
      ? `Published Decision: ${d.action} $${symbol} · confidence ${Math.round(d.confidence)}%`
      : `Published Decision: ${d.action} · confidence ${Math.round(d.confidence)}%`,
    source: 'decision',
  })
  for (const f of d.contributingFactors.slice(0, 4)) {
    out.push({
      id: `${d.id}-${f.engine}-${f.summary.slice(0, 24)}`,
      text: `${String(f.engine).replace(/-/g, ' ')}: ${f.summary}`,
      source: 'factor',
    })
  }
  if (d.expectedROI != null && Number.isFinite(d.expectedROI)) {
    out.push({
      id: `${d.id}-roi`,
      text: `Expected ROI on this Decision: ${d.expectedROI > 0 ? '+' : ''}${d.expectedROI.toFixed(1)}%`,
      source: 'decision',
    })
  }
  return out
}

export function PersistentCoachRail() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const focused = useTerminalOsStore((s) => s.focusedToken)

  const decisionQ = useQuery({
    queryKey: ['tos', 'coach-rail-decision', wallet, focused?.id],
    queryFn: async (): Promise<Decision | null> => {
      if (focused?.id) {
        const qs = new URLSearchParams({ token: focused.id })
        if (wallet) qs.set('wallet', wallet)
        const res = await fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
        if (!res.ok) return null
        const body = (await res.json()) as { decision?: Decision | null }
        if (body.decision) return body.decision
      }
      const qs = new URLSearchParams({ limit: '12' })
      if (wallet) qs.set('wallet', wallet)
      const res = await fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
      if (!res.ok) return null
      const body = (await res.json()) as { decisions?: Decision[] }
      return selectHeroDecision(body.decisions ?? [])
    },
    staleTime: 12_000,
    refetchInterval: 20_000,
    retry: 1,
  })

  const coachAvailQ = useQuery({
    queryKey: ['tos', 'coach-api-available'],
    queryFn: async () => {
      const res = await fetch('/api/portfolio/coach', { cache: 'no-store' })
      const body = (await res.json().catch(() => ({}))) as { available?: boolean }
      return Boolean(body.available)
    },
    staleTime: 60_000,
    retry: 1,
  })

  const decision = decisionQ.data ?? null
  const bullets = decision ? bulletsFromDecision(decision) : []
  const online = coachAvailQ.data === true
  const statusLabel = coachAvailQ.isLoading
    ? 'Checking…'
    : online
      ? 'Online'
      : 'Advisor API offline'

  return (
    <div className="tos-coach-rail" data-tos-coach-rail="true">
      <header className="tos-coach-rail-head">
        <div>
          <p className="tos-coach-rail-kicker">AI Coach</p>
          <h2 className="tos-coach-rail-title">Master Advisor</h2>
        </div>
        <span
          className="tos-coach-rail-status"
          data-online={online ? 'true' : 'false'}
          aria-live="polite"
        >
          {statusLabel}
        </span>
      </header>

      <p className="tos-coach-rail-tone">
        Senior portfolio manager tone — advice only. Not financial advice · DYOR.
      </p>

      {decisionQ.isLoading && !decision ? (
        <p className="tos-coach-rail-empty">Loading Decision context…</p>
      ) : bullets.length > 0 ? (
        <ul className="tos-coach-rail-bullets" aria-label="Decision-backed notes">
          {bullets.map((b) => (
            <li key={b.id} data-source={b.source}>
              {b.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="tos-coach-rail-empty">
          No Decision published yet — notes appear here when the Decision Engine publishes for
          this session.
        </p>
      )}

      {decision?.reasoning ? (
        <div className="tos-coach-rail-rec" data-tos-coach-rec="true">
          <p className="tos-coach-rail-rec-label">From Decision reasoning</p>
          <p className="tos-coach-rail-rec-body">{decision.reasoning.slice(0, 220)}</p>
          <p className="tos-coach-rail-rec-meta">
            Confidence {Math.round(decision.confidence)}%
            {decision.confidenceMode === 'personalized' ? ' · Personalized' : ' · Market'}
          </p>
        </div>
      ) : null}

      <PanelErrorBoundary title="Ask Coach">
        <div className="tos-coach-rail-chat">
          <CoachPanel />
        </div>
      </PanelErrorBoundary>
    </div>
  )
}
