'use client'

/**
 * Reference AI Recommendation card — published Decision only.
 * Kernel: Decision.action / confidence / reasoning / expectedROI.
 * Never invents a second opinion.
 */

import { useQuery } from '@tanstack/react-query'
import type { Decision } from '@cryptocheck/decision-contracts'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { selectHeroDecision, heroReason } from '@/features/ai-os/lib/gateway-round2'

export function AiRecommendationCard() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const focused = useTerminalOsStore((s) => s.focusedToken)

  const q = useQuery({
    queryKey: ['tos', 'ai-rec', wallet, focused?.id],
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
  })

  const d = q.data
  const sym = d?.subject.kind === 'token' ? d.subject.symbol : null

  return (
    <div className="tos-desk-panel tos-rec-card" data-tos-rec="true">
      <header className="tos-desk-panel-head">
        <span>AI Recommendation</span>
        <span className="tos-desk-live" data-on={d ? 'true' : 'false'}>
          {d ? 'From Decision' : 'Waiting'}
        </span>
      </header>
      {!d ? (
        <p className="tos-desk-empty">Waiting for a published Decision — no mock recommendation.</p>
      ) : (
        <div className="tos-rec-body">
          <p className="tos-rec-headline">
            {d.action}
            {sym ? ` $${sym}` : ''}
            {d.expectedROI != null ? (
              <span className="tos-rec-roi">
                {' '}
                · {d.expectedROI > 0 ? '+' : ''}
                {d.expectedROI.toFixed(1)}%
              </span>
            ) : null}
          </p>
          <p className="tos-rec-reason">{heroReason(d.reasoning, 140)}</p>
          <div className="tos-rec-meta">
            <span>
              Confidence <strong className="tos-num">{Math.round(d.confidence)}%</strong>
            </span>
            <span>
              Risk <strong className="tos-num">{Math.round(d.risk)}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
