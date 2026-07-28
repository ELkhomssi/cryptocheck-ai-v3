'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { formatPct, formatUsd } from '@/features/terminal-os/shared/lib/format'
import { mockTraderLeaderboardProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import type { TopTrader } from '@/features/terminal-os/shared/types'

export function TopTradersTicker() {
  const [traders, setTraders] = useState<TopTrader[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    mockTraderLeaderboardProvider
      .getTopTradersToday()
      .then((t) => {
        if (!c) setTraders(t)
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
    return () => {
      c = true
    }
  }, [])

  return (
    <Panel title="Top Traders Today" live>
      {error ? (
        <EmptyState message={error} />
      ) : !traders ? (
        <PanelSkeleton rows={2} />
      ) : traders.length === 0 ? (
        <EmptyState message="No ranked traders yet." />
      ) : (
        <div className="tos-scroll-x">
          {traders.map((t, idx) => (
            <article
              key={t.id}
              style={{
                flex: '0 0 200px',
                padding: 10,
                borderRadius: 10,
                border: '1px solid var(--tos-border-subtle)',
                background: 'var(--tos-bg-panel)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--tos-accent-gold-dim)',
                    color: 'var(--tos-accent-gold)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 11,
                  }}
                >
                  {t.avatarInitials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    #{idx + 1} {t.handle}
                  </div>
                  <div className="tos-muted" style={{ fontSize: 10 }}>
                    WR {t.winRatePct}% · {t.activePositions} pos
                  </div>
                </div>
              </div>
              <div className="tos-num tos-pos" style={{ fontSize: 18, fontWeight: 800 }}>
                {formatPct(t.pnlPct)}
              </div>
              <div className="tos-num tos-secondary" style={{ fontSize: 12 }}>
                {formatUsd(t.pnlUsd, true)}
              </div>
              <div className="tos-muted" style={{ fontSize: 10, marginTop: 8, lineHeight: 1.35 }}>
                AI conf {t.aiConfidence}% — {t.confidenceWhy}
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
