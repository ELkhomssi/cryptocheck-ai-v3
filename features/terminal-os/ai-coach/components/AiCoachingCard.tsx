'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { mockAiCoachProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { CoachInsight } from '@/features/terminal-os/shared/types'

export function AiCoachingCard() {
  const setNav = useTerminalOsStore((s) => s.setActiveNav)
  const [insights, setInsights] = useState<CoachInsight[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    mockAiCoachProvider
      .getInsights()
      .then((i) => {
        if (!c) setInsights(i)
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
    return () => {
      c = true
    }
  }, [])

  const top = insights?.[0]

  return (
    <Panel
      title="AI Coaching"
      action={
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--tos-accent-gold)',
            border: '1px solid color-mix(in srgb, var(--tos-accent-gold) 40%, transparent)',
            borderRadius: 4,
            padding: '1px 5px',
          }}
        >
          BETA
        </span>
      }
    >
      {error ? (
        <EmptyState message={error} />
      ) : !insights ? (
        <PanelSkeleton rows={3} />
      ) : !top ? (
        <EmptyState message="Coach is observing — insights soon." />
      ) : (
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{top.headline}</p>
          <p style={{ fontSize: 11, color: 'var(--tos-text-secondary)', lineHeight: 1.45, marginBottom: 8 }}>
            {top.reasoning}
          </p>
          <p className="tos-muted" style={{ fontSize: 10, lineHeight: 1.4 }}>
            Stat: {top.statistic}
            <br />
            Impact: {top.expectedImpact}
            <br />
            Conf {top.confidence}%
          </p>
          <button
            type="button"
            className="tos-btn tos-btn-gold"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => setNav('ai-coach')}
          >
            ASK COACH AI
          </button>
        </div>
      )}
    </Panel>
  )
}
