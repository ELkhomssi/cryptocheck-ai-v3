'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { Sparkline } from '@/features/terminal-os/shared/components/Sparkline'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import { mockMarketDataProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { ChainId, TokenRow } from '@/features/terminal-os/shared/types'

const TABS: { id: ChainId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'solana', label: 'Solana' },
  { id: 'bnb', label: 'BNB' },
  { id: 'base', label: 'Base' },
  { id: 'ethereum', label: 'Trending' },
]

export function TopTokensToday() {
  const tab = useTerminalOsStore((s) => s.tokenChainTab)
  const setTab = useTerminalOsStore((s) => s.setTokenChainTab)
  const [rows, setRows] = useState<TokenRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    setRows(null)
    mockMarketDataProvider
      .getTopTokens(tab)
      .then((r) => {
        if (!c) setRows(r)
      })
      .catch((e: Error) => {
        if (!c) setError(e.message)
      })
    return () => {
      c = true
    }
  }, [tab])

  return (
    <Panel
      title="Top Tokens Today"
      live
      action={
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="tos-tab"
              data-active={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {error ? (
        <EmptyState message={error} />
      ) : !rows ? (
        <PanelSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState message="No tokens for this chain filter." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr className="tos-muted" style={{ textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Token</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Price</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>24h</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Volume</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--tos-border-subtle)' }}>
                  <td style={{ padding: '8px' }}>
                    <strong>${t.symbol}</strong>
                    <span className="tos-muted" style={{ marginLeft: 6 }}>
                      {t.name}
                    </span>
                  </td>
                  <td className="tos-num" style={{ padding: '8px' }}>
                    {formatUsd(t.priceUsd)}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <Pct value={t.change24hPct} />
                  </td>
                  <td className="tos-num tos-secondary" style={{ padding: '8px' }}>
                    {formatUsd(t.volume24hUsd, true)}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <Sparkline values={t.sparkline} positive={t.change24hPct >= 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
