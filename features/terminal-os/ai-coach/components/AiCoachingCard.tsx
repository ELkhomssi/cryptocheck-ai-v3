'use client'

import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { mockAiCoachProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useEffect, useState } from 'react'
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
            fontSize: '0.5625rem',
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
        <PanelSkeleton rows={2} />
      ) : !top ? (
        <EmptyState message="Coach is observing — insights soon." />
      ) : (
        <div>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              marginBottom: '0.45rem',
            }}
          >
            <div
              style={{
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '999px',
                background: 'var(--tos-accent-gold-dim)',
                color: 'var(--tos-accent-gold)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 'var(--tos-fs-xs)',
              }}
            >
              C
            </div>
            <strong style={{ fontSize: 'var(--tos-fs-sm)' }}>Coach</strong>
          </div>
          <p style={{ fontSize: 'var(--tos-fs-sm)', fontWeight: 700, marginBottom: '0.35rem' }}>
            {top.headline}
          </p>
          <ul
            className="tos-muted"
            style={{
              margin: '0 0 0.5rem',
              paddingLeft: '1rem',
              fontSize: 'var(--tos-fs-xs)',
              lineHeight: 1.4,
            }}
          >
            <li>Analyze performance</li>
            <li>Find weaknesses</li>
            <li>Conf {top.confidence}% · {top.statistic}</li>
          </ul>
          <button
            type="button"
            className="tos-btn tos-btn-gold"
            style={{ width: '100%' }}
            onClick={() => setNav('ai-coach')}
          >
            ASK COACH AI
          </button>
        </div>
      )}
    </Panel>
  )
}
