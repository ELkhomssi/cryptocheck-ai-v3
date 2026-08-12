'use client'

/**
 * Home-desk satellite panels — presentation only.
 * Every number from Decision / whales / holdings / tickMeta. Never invent mockup literals.
 */

import { useQuery } from '@tanstack/react-query'
import type { Decision } from '@cryptocheck/decision-contracts'
import { useWhaleMovements } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { selectHeroDecision } from '@/features/ai-os/lib/gateway-round2'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import type { DecisionTickMeta } from '@/features/ai-os/lib/gateway-phase'

export function DecisionBrainSpokes() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const focused = useTerminalOsStore((s) => s.focusedToken)

  const q = useQuery({
    queryKey: ['tos', 'brain-spokes', wallet, focused?.id],
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
  const factors = d?.contributingFactors?.slice(0, 7) ?? []

  return (
    <div className="tos-desk-panel tos-brain" data-tos-brain="true">
      <header className="tos-desk-panel-head">
        <span>AI Brain Map</span>
        <span className="tos-desk-live" data-on={d ? 'true' : 'false'}>
          {d ? 'Bound to Decision' : 'Waiting'}
        </span>
      </header>
      {!d || factors.length === 0 ? (
        <p className="tos-desk-empty">
          Multi-layer spokes appear when a published Decision includes contributing engines —
          no placeholder scores.
        </p>
      ) : (
        <ul className="tos-brain-spokes" aria-label="Decision contributing engines">
          {factors.map((f) => (
            <li key={`${f.engine}-${f.summary.slice(0, 20)}`}>
              <span className="tos-brain-spoke-label">{String(f.engine).replace(/-/g, ' ')}</span>
              <span className="tos-brain-spoke-pct">{Math.round(f.weight * 100)}%</span>
              <span className="tos-brain-spoke-sum">{f.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CurrentMissionsPanel() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const q = useQuery({
    queryKey: ['tos', 'current-missions', wallet],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: '8' })
      if (wallet) qs.set('wallet', wallet)
      const res = await fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
      if (!res.ok) return { decisions: [] as Decision[], tickMeta: null as DecisionTickMeta | null }
      return (await res.json()) as {
        decisions?: Decision[]
        tickMeta?: DecisionTickMeta | null
      }
    },
    staleTime: 15_000,
    refetchInterval: 25_000,
  })

  const decisions = (q.data?.decisions ?? []).filter(
    (d) => d.action === 'BUY' || d.action === 'SELL' || d.action === 'EXIT',
  )

  return (
    <div className="tos-desk-panel" data-tos-missions="true">
      <header className="tos-desk-panel-head">
        <span>Current Missions</span>
        <span className="tos-desk-live" data-on={decisions.length > 0 ? 'true' : 'false'}>
          {decisions.length ? `${decisions.length} active` : 'None'}
        </span>
      </header>
      {decisions.length === 0 ? (
        <p className="tos-desk-empty">No actionable Decisions published yet.</p>
      ) : (
        <ul className="tos-missions-list">
          {decisions.slice(0, 5).map((d) => {
            const sym = d.subject.kind === 'token' ? d.subject.symbol : '—'
            const pct = Math.min(100, Math.max(8, Math.round(d.confidence)))
            return (
              <li key={d.id}>
                <div className="tos-missions-row">
                  <strong>
                    {d.action} {sym}
                  </strong>
                  <span>{Math.round(d.confidence)}%</span>
                </div>
                <div className="tos-missions-bar" aria-hidden>
                  <i style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function LiveExecutionFeed() {
  const whalesQ = useWhaleMovements(16)
  const items = (whalesQ.data ?? []).slice(0, 10)

  return (
    <div className="tos-desk-panel tos-exec-feed" data-tos-exec-feed="true">
      <header className="tos-desk-panel-head">
        <span>Live Execution Feed</span>
        <span className="tos-desk-live" data-on={items.length > 0 ? 'true' : 'false'}>
          {whalesQ.isFetching ? 'Updating' : items.length ? 'Live' : 'Idle'}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="tos-desk-empty">No recent whale / flow events.</p>
      ) : (
        <ul className="tos-exec-feed-list">
          {items.map((w) => (
            <li key={w.id}>
              <time dateTime={w.occurredAt}>
                {new Date(w.occurredAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </time>
              <span>
                {w.action.toUpperCase()} {w.assetSymbol} · {formatUsd(w.usdValue, true)}
              </span>
              <em>{w.classification}</em>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PositionsSnapshot() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const connected = useTerminalOsStore((s) => s.walletConnected)

  const q = useQuery({
    queryKey: ['tos', 'positions-snap', wallet],
    enabled: Boolean(connected && wallet),
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/holdings?wallet=${encodeURIComponent(wallet!)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Holdings unavailable')
      return (await res.json()) as HoldingsResponse
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  })

  const rows = (q.data?.holdings ?? []).slice(0, 6)

  return (
    <div className="tos-desk-panel" data-tos-positions="true">
      <header className="tos-desk-panel-head">
        <span>Positions</span>
        <span className="tos-desk-live" data-on={rows.length > 0 ? 'true' : 'false'}>
          {connected ? `${rows.length} shown` : 'Connect'}
        </span>
      </header>
      {!connected ? (
        <p className="tos-desk-empty">Connect wallet to load positions.</p>
      ) : q.isLoading ? (
        <p className="tos-desk-empty">Loading holdings…</p>
      ) : rows.length === 0 ? (
        <p className="tos-desk-empty">No positions in this wallet.</p>
      ) : (
        <table className="tos-positions-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Value</th>
              <th>24h</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.mint}>
                <td>{h.symbol || h.mint.slice(0, 4)}</td>
                <td className="tos-num">{formatUsd(h.valueUsd ?? 0, true)}</td>
                <td>
                  {h.change24hPct != null ? <Pct value={h.change24hPct} /> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function AutonomousWorkflowStrip() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const q = useQuery({
    queryKey: ['tos', 'workflow-tick', wallet],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: '1' })
      if (wallet) qs.set('wallet', wallet)
      const res = await fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
      if (!res.ok) return null
      const body = (await res.json()) as { tickMeta?: DecisionTickMeta | null }
      return body.tickMeta ?? null
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  })

  const meta = q.data
  const stages = ['Discover', 'Analyze', 'Decide', 'Execute', 'Monitor', 'Learn'] as const

  return (
    <div className="tos-desk-panel tos-workflow" data-tos-workflow="true">
      <header className="tos-desk-panel-head">
        <span>Autonomous Workflow</span>
        <span className="tos-desk-live" data-on={meta ? 'true' : 'false'}>
          Advise-only default
        </span>
      </header>
      <ol className="tos-workflow-stages">
        {stages.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div className="tos-workflow-stats">
        {meta && meta.scanned > 0 ? (
          <>
            <span>
              Scanned <strong>{meta.scanned}</strong>
            </span>
            <span>
              Published <strong>{meta.published}</strong>
            </span>
            <span>
              Buy signals <strong>{meta.buyCount}</strong>
            </span>
          </>
        ) : (
          <span className="tos-desk-empty">Waiting for Decision Engine tick meta.</span>
        )}
      </div>
    </div>
  )
}

export function ScannerDiscoveryStrip() {
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)
  const setNav = useTerminalOsStore((s) => s.setActiveNav)

  const q = useQuery({
    queryKey: ['tos', 'scanner-strip'],
    queryFn: async () => {
      const res = await fetch('/api/terminal-os/feed?resource=tokens&chain=solana&limit=8', {
        cache: 'no-store',
      })
      if (!res.ok) return []
      const body = (await res.json()) as {
        items?: Array<{
          id: string
          symbol: string
          name: string
          chain: string
          priceUsd: number
          change24hPct: number
          logoUrl?: string
        }>
      }
      return body.items ?? []
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  })

  const rows = q.data ?? []

  return (
    <div className="tos-desk-panel" data-tos-scanner="true">
      <header className="tos-desk-panel-head">
        <span>Scanner & Discovery</span>
        <span className="tos-desk-live" data-on={rows.length > 0 ? 'true' : 'false'}>
          {rows.length ? 'Live feed' : 'Empty'}
        </span>
      </header>
      {rows.length === 0 ? (
        <p className="tos-desk-empty">Token feed unavailable.</p>
      ) : (
        <table className="tos-scanner-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Price</th>
              <th>24h</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((t) => (
              <tr key={t.id}>
                <td>{t.symbol}</td>
                <td className="tos-num">{formatUsd(t.priceUsd)}</td>
                <td>
                  <Pct value={t.change24hPct} />
                </td>
                <td>
                  <button
                    type="button"
                    className="tos-scanner-buy"
                    onClick={() => {
                      setFocused({
                        id: t.id,
                        symbol: t.symbol,
                        name: t.name,
                        chain: 'solana',
                        priceUsd: t.priceUsd,
                        logoUrl: t.logoUrl,
                      })
                      setNav('terminal')
                    }}
                  >
                    Focus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
