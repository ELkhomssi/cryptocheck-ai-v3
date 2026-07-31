'use client'

import { useQuery } from '@tanstack/react-query'
import { useWallet } from '@solana/wallet-adapter-react'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'

type PositionRow = {
  mint: string
  symbol?: string
  amountTokens?: number
  avgEntryPriceUsd?: number
  currentPriceUsd?: number
  pnlUsd?: number
  pnlPct?: number
}

async function fetchPositions(wallet: string): Promise<PositionRow[]> {
  const res = await fetch(`/api/portfolio/${encodeURIComponent(wallet)}`)
  if (!res.ok) return []
  const body = (await res.json()) as {
    positions?: PositionRow[]
    holdings?: PositionRow[]
  }
  return body.positions ?? body.holdings ?? []
}

/**
 * Position Manager — reads Portfolio Intelligence / portfolio API.
 * Does not recompute PnL independently when the API provides it.
 */
export function PositionManager() {
  const wallet = useWallet()
  const addr = wallet.publicKey?.toBase58()
  const q = useQuery({
    queryKey: ['execution-desk', 'positions', addr],
    queryFn: () => fetchPositions(addr!),
    enabled: Boolean(addr),
    staleTime: 20_000,
    refetchInterval: 30_000,
  })

  return (
    <section className="ex-panel" aria-label="Position Manager">
      <header className="ex-panel-head">
        <h2>Position Manager</h2>
        <span className="ex-live">LIVE</span>
      </header>

      {!addr ? (
        <EmptyState message="Connect a wallet to load open positions." />
      ) : q.isLoading ? (
        <PanelSkeleton rows={4} />
      ) : !q.data?.length ? (
        <EmptyState message="No open positions from Portfolio Intelligence." />
      ) : (
        <ul className="ex-pos-list">
          {q.data.map((p) => {
            const pnl = p.pnlUsd
            const pct = p.pnlPct
            return (
              <li key={p.mint} className="ex-pos-row">
                <div className="ex-pos-top">
                  <strong>${p.symbol ?? p.mint.slice(0, 4)}</strong>
                  <span className={pnl != null && pnl >= 0 ? 'ex-pos' : 'ex-neg'}>
                    {pnl == null ? '—' : `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`}
                    {pct != null ? ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)` : ''}
                  </span>
                </div>
                <div className="ex-pos-meta">
                  Entry {p.avgEntryPriceUsd != null ? `$${p.avgEntryPriceUsd}` : '—'} · Now{' '}
                  {p.currentPriceUsd != null ? `$${p.currentPriceUsd}` : '—'}
                  {p.amountTokens != null ? ` · ${p.amountTokens.toPrecision(4)} units` : ''}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="ex-muted">Open TP/SL & fills surface here when Automation Engine reports them.</p>
    </section>
  )
}
