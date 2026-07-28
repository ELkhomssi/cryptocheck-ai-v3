'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { CandlestickChart } from './CandlestickChart'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import { mockMarketDataProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import type { ChainMarketSnapshot } from '@/features/terminal-os/shared/types'

export function MultiChainChartGrid() {
  const [snaps, setSnaps] = useState<ChainMarketSnapshot[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    mockMarketDataProvider
      .getChainSnapshots()
      .then((s) => {
        if (!c) setSnaps(s)
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
    return () => {
      c = true
    }
  }, [])

  return (
    <Panel title="Multi-Chain Charts" live>
      {error ? (
        <EmptyState message={error} />
      ) : !snaps ? (
        <PanelSkeleton rows={6} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {snaps.map((s) => (
            <div
              key={s.chain}
              style={{
                border: '1px solid var(--tos-border-subtle)',
                borderRadius: 10,
                padding: 10,
                background: 'var(--tos-bg-panel)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 8,
                  color: 'var(--tos-text-primary)',
                }}
              >
                Top {s.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 8 }}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 11 }}>
                  {s.topTokens.length === 0 ? (
                    <li className="tos-muted">No leaders</li>
                  ) : (
                    s.topTokens.map((t) => (
                      <li
                        key={t.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 6,
                          padding: '4px 0',
                          borderBottom: '1px solid var(--tos-border-subtle)',
                        }}
                      >
                        <span>${t.symbol}</span>
                        <span className="tos-num">
                          <Pct value={t.change24hPct} />
                        </span>
                      </li>
                    ))
                  )}
                </ul>
                <CandlestickChart candles={s.candles} height={120} />
              </div>
              {s.topTokens[0] ? (
                <div className="tos-muted" style={{ fontSize: 10, marginTop: 6 }}>
                  Lead vol {formatUsd(s.topTokens[0].volume24hUsd, true)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
