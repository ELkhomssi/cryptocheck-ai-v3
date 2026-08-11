'use client'

/**
 * Home-desk satellite panels — presentation only (Layer 4).
 * Every number traces to Decision / attention / whales / holdings / tickMeta / DNA / real fills.
 * Never invent mockup literals (no fake confidence %, no inflated executed counts, no stub DNA %).
 *
 * KERNEL CONNECTION DECLARATIONS (Step 1 — mandatory per panel):
 * - DecisionBrainSpokes → Decision.contributingFactors (published Decision only)
 * - CurrentMissionsPanel → published Decisions with actionable BUY/SELL/EXIT
 * - LiveExecutionFeed → attention snapshot events + whale movements (real timestamps)
 * - PositionsSnapshot → Portfolio Intelligence /api/portfolio/holdings
 * - ScannerDiscoveryStrip → ranked published Decisions (confidence / expectedROI / risk)
 * - OnChainHeatmap → holdings sized by real valueUsd / allocationPct
 * - TradeLikeMeDnaCard → TraderDna.confidence, sampleSize, tradingStyleSummary, winRatePct
 * - AutonomousWorkflowStrip → tickMeta stages + execution bridge + DNA learn + real fill count
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Decision } from '@cryptocheck/decision-contracts'
import { useWhaleMovements } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { selectHeroDecision } from '@/features/ai-os/lib/gateway-round2'
import { formatUsd } from '@/features/terminal-os/shared/lib/format'
import { Pct } from '@/features/terminal-os/shared/components/Pct'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import type { DecisionTickMeta } from '@/features/ai-os/lib/gateway-phase'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import {
  IN_FLIGHT_EXECUTION,
  useExecutionLifecycleBridge,
} from '@/features/terminal-os/money-lifecycle/execution-lifecycle-bridge'

type AttentionLiveEvent = {
  seq: number
  kind: string
  eventType: string
  itemId: string
  at: string
}

type AttentionItemLite = {
  id: string
  sourceEngine: string
  headline: string
  createdAt: string
}

type FeedRow = {
  id: string
  at: string
  title: string
  detail: string
}

const WORKFLOW_STAGES = ['Discover', 'Analyze', 'Decide', 'Execute', 'Monitor', 'Learn'] as const
type WorkflowStage = (typeof WORKFLOW_STAGES)[number]

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

function eventLabel(eventType: string): string {
  switch (eventType) {
    case 'DecisionMade':
      return 'AI Decision'
    case 'SecurityFlagRaised':
      return 'Risk check'
    case 'WhaleFlow':
      return 'Whale flow'
    case 'PortfolioChanged':
      return 'Portfolio'
    case 'DNAUpdated':
      return 'DNA update'
    case 'MarketContextChanged':
      return 'Market context'
    default:
      return eventType.replace(/([A-Z])/g, ' $1').trim()
  }
}

const BRAIN_SIGNAL_SLOTS: { engine: string | null; label: string }[] = [
  { engine: 'market-intelligence', label: 'Market Sentiment' },
  { engine: 'whale-intelligence', label: 'Whale Activity' },
  { engine: 'liquidity-engine', label: 'Liquidity Flow' },
  { engine: 'portfolio-intelligence', label: 'On-chain Data' },
  { engine: 'security-scanner', label: 'Security' },
  { engine: 'prediction-engine', label: 'Prediction' },
  { engine: null, label: 'Social Momentum' },
  { engine: null, label: 'Funding Rate' },
]

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
  const byEngine = new Map(
    (d?.contributingFactors ?? []).map((f) => [String(f.engine), f] as const),
  )
  const slots = BRAIN_SIGNAL_SLOTS.map((s) => {
    if (!s.engine) return { ...s, pct: null as number | null, summary: 'No engine wired yet' }
    const f = byEngine.get(s.engine)
    return {
      ...s,
      pct: f ? Math.round(f.weight * 100) : null,
      summary: f?.summary ?? 'Unavailable in this Decision',
    }
  })
  const liveSlots = slots.filter((s) => s.pct != null)
  const cx = 140
  const cy = 140
  const orbitR = 92

  return (
    <div className="tos-desk-panel tos-brain" data-tos-brain="true">
      <header className="tos-desk-panel-head">
        <span>AI Brain Map</span>
        <span className="tos-desk-live" data-on={d ? 'true' : 'false'}>
          {d ? 'Bound to Decision' : 'Waiting'}
        </span>
      </header>
      {!d ? (
        <div className="tos-brain-orbit tos-brain-orbit--empty" aria-hidden>
          <div className="tos-brain-core">
            <span>WAITING</span>
          </div>
          <p className="tos-desk-empty">
            Orbital intelligence layers appear when a Decision publishes contributing engines —
            unavailable signals stay as —.
          </p>
        </div>
      ) : (
        <div className="tos-brain-orbit" role="img" aria-label="Decision intelligence layers">
          <svg viewBox="0 0 280 280" className="tos-brain-svg">
            <defs>
              <radialGradient id="tosBrainCore" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00e0ff" stopOpacity="0.55" />
                <stop offset="70%" stopColor="#0a0e14" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0a0e14" stopOpacity="1" />
              </radialGradient>
            </defs>
            <circle cx={cx} cy={cy} r={orbitR} className="tos-brain-ring" />
            <circle cx={cx} cy={cy} r={orbitR * 0.62} className="tos-brain-ring tos-brain-ring--inner" />
            <circle cx={cx} cy={cy} r={38} fill="url(#tosBrainCore)" className="tos-brain-core-disk" />
            <text x={cx} y={cy - 4} textAnchor="middle" className="tos-brain-core-text">
              {d.subject?.kind === 'token' ? d.subject.symbol : 'AI'}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" className="tos-brain-core-sub">
              {Math.round(d.confidence)}%
            </text>
            {slots.map((s, i) => {
              const angle = (i / slots.length) * Math.PI * 2 - Math.PI / 2
              const px = cx + Math.cos(angle) * orbitR
              const py = cy + Math.sin(angle) * orbitR
              const live = s.pct != null
              return (
                <g key={s.label} opacity={live ? 1 : 0.45}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={px}
                    y2={py}
                    className="tos-brain-spoke-line"
                    strokeDasharray={live ? undefined : '3 4'}
                  />
                  <circle
                    cx={px}
                    cy={py}
                    r={live ? 16 + (s.pct ?? 0) / 12 : 12}
                    className="tos-brain-node"
                  />
                  <text x={px} y={py - 2} textAnchor="middle" className="tos-brain-node-pct">
                    {live ? `${s.pct}%` : '—'}
                  </text>
                  <text x={px} y={py + 10} textAnchor="middle" className="tos-brain-node-label">
                    {s.label.slice(0, 12)}
                  </text>
                </g>
              )
            })}
          </svg>
          <ul className="tos-brain-legend">
            {slots.map((s) => (
              <li key={s.label} data-live={s.pct != null ? 'true' : 'false'}>
                <strong>
                  {s.label} · {s.pct != null ? `${s.pct}%` : '—'}
                </strong>
                <span>{s.summary}</span>
              </li>
            ))}
          </ul>
          {liveSlots.length === 0 ? (
            <p className="tos-desk-empty">Decision published — no contributing factors yet.</p>
          ) : null}
        </div>
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
      if (!res.ok) return { decisions: [] as Decision[] }
      return (await res.json()) as { decisions?: Decision[] }
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
        <p className="tos-desk-empty">No active missions</p>
      ) : (
        <ul className="tos-missions-list">
          {decisions.slice(0, 5).map((d) => {
            const sym = d.subject?.kind === 'token' ? d.subject.symbol : '—'
            const pct = Math.min(100, Math.max(8, Math.round(d.confidence ?? 0)))
            return (
              <li key={d.id}>
                <div className="tos-missions-row">
                  <strong>
                    {d.action} {sym}
                  </strong>
                  <span>{Math.round(d.confidence ?? 0)}%</span>
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

/**
 * Kernel: attention live events (Decision / security / whale / portfolio / DNA)
 * plus whale movements with real occurredAt. Never stocks a fake feed.
 */
export function LiveExecutionFeed() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const whalesQ = useWhaleMovements(12)

  const attentionQ = useQuery({
    queryKey: ['tos', 'exec-feed-attention', wallet],
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (wallet) qs.set('wallet', wallet)
      const res = await fetch(`/api/terminal-os/attention/snapshot?${qs}`, { cache: 'no-store' })
      if (!res.ok) {
        return { events: [] as AttentionLiveEvent[], items: [] as AttentionItemLite[] }
      }
      return (await res.json()) as {
        events?: AttentionLiveEvent[]
        items?: AttentionItemLite[]
      }
    },
    staleTime: 8_000,
    refetchInterval: 12_000,
  })

  const rows = useMemo(() => {
    const byId = new Map<string, AttentionItemLite>()
    for (const item of attentionQ.data?.items ?? []) byId.set(item.id, item)

    const fromAttention: FeedRow[] = (attentionQ.data?.events ?? []).map((ev) => {
      const item = byId.get(ev.itemId)
      return {
        id: `att-${ev.seq}-${ev.itemId}`,
        at: ev.at,
        title: item?.headline ?? eventLabel(ev.eventType),
        detail: eventLabel(ev.eventType),
      }
    })

    const fromWhales: FeedRow[] = (whalesQ.data ?? []).map((w) => ({
      id: `whale-${w.id}`,
      at: w.occurredAt,
      title: `${w.action.toUpperCase()} ${w.assetSymbol} · ${formatUsd(w.usdValue, true)}`,
      detail: w.classification || 'Whale movement',
    }))

    return [...fromAttention, ...fromWhales]
      .filter((r) => r.at && Number.isFinite(new Date(r.at).getTime()))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 12)
  }, [attentionQ.data, whalesQ.data])

  const live = rows.length > 0

  return (
    <div className="tos-desk-panel tos-exec-feed" data-tos-exec-feed="true">
      <header className="tos-desk-panel-head">
        <span>Live Execution Feed</span>
        <span className="tos-desk-live" data-on={live ? 'true' : 'false'}>
          {attentionQ.isFetching || whalesQ.isFetching ? 'Updating' : live ? 'Live' : 'Idle'}
        </span>
      </header>
      {rows.length === 0 ? (
        <p className="tos-desk-empty">No activity yet</p>
      ) : (
        <ul className="tos-exec-feed-list">
          {rows.map((r) => (
            <li key={r.id}>
              <time dateTime={r.at} title={new Date(r.at).toLocaleString()}>
                {relativeTime(r.at)}
              </time>
              <span>{r.title}</span>
              <em>{r.detail}</em>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Kernel: Portfolio holdings + analytics (entry / unrealized when FIFO available). */
export function PositionsSnapshot() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const connected = useTerminalOsStore((s) => s.walletConnected)

  const q = useQuery({
    queryKey: ['tos', 'positions-analytics', wallet],
    enabled: Boolean(connected && wallet),
    queryFn: async () => {
      const [holdingsRes, analyticsRes] = await Promise.all([
        fetch(`/api/portfolio/holdings?wallet=${encodeURIComponent(wallet!)}`, {
          cache: 'no-store',
        }),
        fetch(`/api/portfolio/analytics?wallet=${encodeURIComponent(wallet!)}`, {
          cache: 'no-store',
        }),
      ])
      if (!holdingsRes.ok) throw new Error('Holdings unavailable')
      const holdings = (await holdingsRes.json()) as HoldingsResponse
      const analytics = analyticsRes.ok
        ? ((await analyticsRes.json()) as {
            holdings?: Array<{
              mint: string
              avgEntryPriceUsd: number | null
              unrealizedPnlUsd: number | null
              allocationPct: number
            }>
            unrealizedPnl?: number | null
          })
        : null
      return { holdings, analytics }
    },
    staleTime: 20_000,
    refetchInterval: 45_000,
  })

  const analyticsByMint = new Map(
    (q.data?.analytics?.holdings ?? []).map((h) => [h.mint, h] as const),
  )
  const rows = (q.data?.holdings?.holdings ?? []).slice(0, 6)
  const totalUnrealized = q.data?.analytics?.unrealizedPnl

  return (
    <div className="tos-desk-panel" data-tos-positions="true">
      <header className="tos-desk-panel-head">
        <span>Positions</span>
        <span className="tos-desk-live" data-on={rows.length > 0 ? 'true' : 'false'}>
          {connected ? (rows.length ? `${rows.length} open` : 'Empty') : 'Connect'}
        </span>
      </header>
      {!connected ? (
        <p className="tos-desk-empty">Connect wallet to load positions.</p>
      ) : q.isLoading ? (
        <p className="tos-desk-empty">Loading holdings…</p>
      ) : rows.length === 0 ? (
        <p className="tos-desk-empty">No open positions</p>
      ) : (
        <>
          <table className="tos-positions-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Size</th>
                <th>Entry</th>
                <th>uPnL</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => {
                const a = analyticsByMint.get(h.mint)
                return (
                  <tr key={h.mint}>
                    <td>
                      {h.symbol || h.mint.slice(0, 4)}
                      {a?.allocationPct != null ? (
                        <span className="tos-muted"> {a.allocationPct.toFixed(0)}%</span>
                      ) : null}
                    </td>
                    <td className="tos-num">{formatUsd(h.valueUsd ?? 0, true)}</td>
                    <td className="tos-num">
                      {a?.avgEntryPriceUsd != null ? formatUsd(a.avgEntryPriceUsd) : '—'}
                    </td>
                    <td className="tos-num">
                      {a?.unrealizedPnlUsd != null ? (
                        <span className={a.unrealizedPnlUsd >= 0 ? 'tos-pos' : 'tos-neg'}>
                          {formatUsd(a.unrealizedPnlUsd, true)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="tos-positions-foot">
            {totalUnrealized != null ? (
              <>
                Unrealized{' '}
                <strong className="tos-num">{formatUsd(totalUnrealized, true)}</strong>
              </>
            ) : (
              <span className="tos-muted">Avg-cost PnL unavailable until fill history</span>
            )}
          </p>
        </>
      )}
    </div>
  )
}

/**
 * Kernel: tickMeta (Discover/Analyze/Decide), execution bridge (Execute),
 * attention freshness (Monitor), DNA sampleSize (Learn).
 * "Executed" = real on-chain fills for this wallet — never tickMeta.buyCount.
 */
export function AutonomousWorkflowStrip() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const connected = useTerminalOsStore((s) => s.walletConnected)
  const executionState = useExecutionLifecycleBridge((s) => s.executionState)
  const { state: tlm } = useTradeLikeMeEngine()

  const tickQ = useQuery({
    queryKey: ['tos', 'workflow-tick', wallet],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: '1' })
      if (wallet) qs.set('wallet', wallet)
      const res = await fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
      if (!res.ok) return null
      const body = (await res.json()) as { tickMeta?: DecisionTickMeta | null; decisions?: Decision[] }
      return body
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  })

  const fillsQ = useQuery({
    queryKey: ['tos', 'workflow-fills', wallet],
    enabled: Boolean(connected && wallet),
    queryFn: async () => {
      const res = await fetch(
        `/api/terminal-os/captured-trades?wallet=${encodeURIComponent(wallet!)}`,
        { cache: 'no-store' },
      )
      if (!res.ok) return { executed: 0, decisionsPublished: 0 }
      const body = (await res.json()) as {
        executedFills?: number
        decisionsPublished?: number
        count?: number
      }
      return {
        executed: body.executedFills ?? 0,
        decisionsPublished: body.decisionsPublished ?? body.count ?? 0,
      }
    },
    staleTime: 30_000,
    refetchInterval: 45_000,
  })

  const attentionQ = useQuery({
    queryKey: ['tos', 'workflow-attention', wallet],
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (wallet) qs.set('wallet', wallet)
      const res = await fetch(`/api/terminal-os/attention/snapshot?${qs}`, { cache: 'no-store' })
      if (!res.ok) return { updatedAt: null as string | null, eventCount: 0 }
      const body = (await res.json()) as { updatedAt?: string; events?: unknown[] }
      return {
        updatedAt: body.updatedAt ?? null,
        eventCount: body.events?.length ?? 0,
      }
    },
    staleTime: 15_000,
    refetchInterval: 20_000,
  })

  const meta = tickQ.data?.tickMeta ?? null
  const published = meta?.published ?? 0
  const scanned = meta?.scanned ?? 0
  const executed = fillsQ.data?.executed ?? 0
  const decisionsShown = published

  const active = useMemo(() => {
    const set = new Set<WorkflowStage>()
    if (scanned > 0) set.add('Discover')
    if (scanned > 0) set.add('Analyze')
    if (published > 0) set.add('Decide')
    if (IN_FLIGHT_EXECUTION.has(executionState) || executionState === 'confirmed') {
      set.add('Execute')
    }
    const attAt = attentionQ.data?.updatedAt
    if (attAt) {
      const age = Date.now() - new Date(attAt).getTime()
      if (Number.isFinite(age) && age < 5 * 60_000 && (attentionQ.data?.eventCount ?? 0) > 0) {
        set.add('Monitor')
      }
    }
    if (tlm.dna && tlm.dna.sampleSize > 0 && !tlm.dna.sample) set.add('Learn')
    return set
  }, [scanned, published, executionState, attentionQ.data, tlm.dna])

  return (
    <div className="tos-desk-panel tos-workflow" data-tos-workflow="true">
      <header className="tos-desk-panel-head">
        <span>Autonomous Workflow</span>
        <span className="tos-desk-live" data-on={meta ? 'true' : 'false'}>
          Advise-only default
        </span>
      </header>
      <ol className="tos-workflow-stages" aria-label="Workflow stages">
        {WORKFLOW_STAGES.map((s) => (
          <li key={s} data-active={active.has(s) ? 'true' : 'false'}>
            {s}
          </li>
        ))}
      </ol>
      <div className="tos-workflow-stats">
        {meta && scanned > 0 ? (
          <>
            <span>
              Decisions <strong>{decisionsShown}</strong>
            </span>
            <span>
              Executed <strong>{executed}</strong>
            </span>
            <span className="tos-muted tos-workflow-note">
              Executed = real fills for this wallet, not BUY signals
            </span>
          </>
        ) : (
          <span className="tos-desk-empty">Waiting for Decision Engine tick meta.</span>
        )}
      </div>
    </div>
  )
}

/**
 * Kernel: ranked published Decisions only — confidence / expectedROI / risk from Decision.
 * Empty: "Scanning — no ranked opportunities yet"
 */
export function ScannerDiscoveryStrip() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)
  const setNav = useTerminalOsStore((s) => s.setActiveNav)

  const q = useQuery({
    queryKey: ['tos', 'scanner-decisions', wallet],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: '16' })
      if (wallet) qs.set('wallet', wallet)
      const res = await fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
      if (!res.ok) return [] as Decision[]
      const body = (await res.json()) as { decisions?: Decision[] }
      return (body.decisions ?? [])
        .filter((d) => d.subject?.kind === 'token')
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
        .slice(0, 6)
    },
    staleTime: 15_000,
    refetchInterval: 25_000,
  })

  const rows = q.data ?? []

  return (
    <div className="tos-desk-panel" data-tos-scanner="true">
      <header className="tos-desk-panel-head">
        <span>Scanner &amp; Discovery</span>
        <span className="tos-desk-live" data-on={rows.length > 0 ? 'true' : 'false'}>
          {rows.length ? 'From Decisions' : 'Scanning'}
        </span>
      </header>
      {q.isLoading ? (
        <p className="tos-desk-empty">Loading ranked Decisions…</p>
      ) : rows.length === 0 ? (
        <p className="tos-desk-empty">Scanning — no ranked opportunities yet</p>
      ) : (
        <table className="tos-scanner-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Conf</th>
              <th>ROI</th>
              <th>Risk</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const sym = d.subject?.kind === 'token' ? d.subject.symbol : '—'
              const mint = d.subject?.kind === 'token' ? d.subject.address || sym : sym
              return (
                <tr key={d.id}>
                  <td>
                    <strong>{sym}</strong>
                    <span className="tos-scanner-act"> {d.action}</span>
                  </td>
                  <td className="tos-num">{Math.round(d.confidence ?? 0)}%</td>
                  <td className="tos-num">
                    {d.expectedROI != null && typeof d.expectedROI === 'number'
                      ? `${d.expectedROI > 0 ? '+' : ''}${d.expectedROI.toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="tos-num">{Math.round(d.risk ?? 0)}</td>
                  <td>
                    <button
                      type="button"
                      className="tos-scanner-buy"
                      onClick={() => {
                        setFocused({
                          id: mint,
                          symbol: sym,
                          name: sym,
                          chain: 'solana',
                          priceUsd: 0,
                        })
                        setNav('terminal')
                      }}
                    >
                      Focus
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

/**
 * Kernel: Portfolio holdings sized by real USD value / allocationPct.
 * No fabricated node sizes — empty when no holdings.
 */
export function OnChainHeatmap() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const connected = useTerminalOsStore((s) => s.walletConnected)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)

  const q = useQuery({
    queryKey: ['tos', 'heatmap-holdings', wallet],
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

  const nodes = useMemo(() => {
    const holdings = (q.data?.holdings ?? []).filter((h) => (h.valueUsd ?? 0) > 0).slice(0, 12)
    const max = Math.max(...holdings.map((h) => h.valueUsd ?? 0), 1)
    return holdings.map((h) => ({
      holding: h,
      // 0.45–1 scale from real USD — never invented
      scale: 0.45 + 0.55 * ((h.valueUsd ?? 0) / max),
    }))
  }, [q.data])

  return (
    <div className="tos-desk-panel tos-heatmap" data-tos-heatmap="true">
      <header className="tos-desk-panel-head">
        <span>On-Chain Heatmap</span>
        <span className="tos-desk-live" data-on={nodes.length > 0 ? 'true' : 'false'}>
          {connected ? (nodes.length ? 'By USD value' : 'Empty') : 'Connect'}
        </span>
      </header>
      {!connected ? (
        <p className="tos-desk-empty">Connect wallet to map real holdings.</p>
      ) : q.isLoading ? (
        <p className="tos-desk-empty">Loading holdings…</p>
      ) : nodes.length === 0 ? (
        <p className="tos-desk-empty">Not enough holdings to map yet</p>
      ) : (
        <div className="tos-heatmap-field" role="list" aria-label="Holdings by USD value">
          {nodes.map(({ holding: h, scale }) => (
            <button
              key={h.mint}
              type="button"
              role="listitem"
              className="tos-heatmap-node"
              style={{
                ['--hm-scale' as string]: String(scale),
                ['--hm-heat' as string]: heatFromChange(h.change24hPct),
              }}
              title={`${h.symbol}: ${formatUsd(h.valueUsd ?? 0, true)} (${(h.allocationPct ?? 0).toFixed(1)}%)`}
              onClick={() =>
                setFocused({
                  id: h.mint,
                  symbol: h.symbol,
                  name: h.name,
                  chain: 'solana',
                  priceUsd: h.priceUsd,
                  logoUrl: h.logoUrl ?? undefined,
                })
              }
            >
              <span className="tos-heatmap-sym">{h.symbol}</span>
              <span className="tos-heatmap-pct">{(h.allocationPct ?? 0).toFixed(0)}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function heatFromChange(pct: number | null): string {
  if (pct == null) return '0.5'
  // Map −15..+15 → 0..1 for CSS color mix
  const t = Math.max(0, Math.min(1, (pct + 15) / 30))
  return t.toFixed(3)
}

/**
 * Kernel: TraderDna from orchestrator / Redis hydrate.
 * Shows confidence, sampleSize, tradingStyleSummary, winRatePct — or honest training empty.
 * Never displays a fabricated DNA percentage as live training.
 */
export function TradeLikeMeDnaCard() {
  const connected = useTerminalOsStore((s) => s.walletConnected)
  const setNav = useTerminalOsStore((s) => s.setActiveNav)
  const { state, busy, trainAiFromMyTrading } = useTradeLikeMeEngine()
  const dna = state.dna

  const ready = Boolean(dna && dna.sampleSize > 0 && !dna.sample)

  return (
    <div className="tos-desk-panel tos-dna-card" data-tos-dna-card="true">
      <header className="tos-desk-panel-head">
        <span>Trade Like Me (DNA)</span>
        <span className="tos-desk-live" data-on={ready ? 'true' : 'false'}>
          {dna?.sample ? 'Sample' : ready ? 'Trained' : 'Training'}
        </span>
      </header>

      {!connected ? (
        <p className="tos-desk-empty">Connect a Solana wallet to train Trader DNA.</p>
      ) : !dna || dna.sampleSize < 1 || dna.sample ? (
        <div className="tos-dna-empty">
          <div className="tos-dna-helix" aria-hidden>
            <i />
            <i />
            <i />
          </div>
          <p className="tos-desk-empty">
            {dna?.sample
              ? 'Sample DNA is not shown as live — train from real fills.'
              : 'TRAINING — Not enough real trading history yet'}
          </p>
          <button
            type="button"
            className="tos-scanner-buy"
            disabled={busy}
            onClick={() => void trainAiFromMyTrading()}
          >
            Train from my trading
          </button>
        </div>
      ) : (
        <div className="tos-dna-compact">
          <div className="tos-dna-visual">
            <div className="tos-dna-helix" aria-hidden>
              <i />
              <i />
              <i />
            </div>
            <div className="tos-dna-match">
              <span className="tos-dna-match-val tos-num">{dna.confidence}%</span>
              <span className="tos-dna-match-label">DNA confidence</span>
            </div>
          </div>
          <p className="tos-dna-style">{dna.tradingStyleSummary}</p>
          <div className="tos-dna-metrics">
            <span>
              Win rate <strong className="tos-num">{dna.winRatePct}%</strong>
            </span>
            <span>
              Sample <strong className="tos-num">{dna.sampleSize}</strong>
            </span>
            <span>
              Risk <strong>{dna.riskAppetiteLabel}</strong>
            </span>
            <span>
              Hold{' '}
              <strong className="tos-num">
                {(dna.avgHoldingMs ?? 0) > 0
                  ? (dna.avgHoldingMs ?? 0) < 3_600_000
                    ? `${Math.round((dna.avgHoldingMs ?? 0) / 60_000)}m`
                    : `${((dna.avgHoldingMs ?? 0) / 3_600_000).toFixed(1)}h`
                  : '—'}
              </strong>
            </span>
            <span>
              Loss tol <strong className="tos-num">−{dna.lossTolerancePct ?? '—'}%</strong>
            </span>
          </div>
          <button type="button" className="tos-scanner-buy" onClick={() => setNav('ai-trading')}>
            Open DNA desk
          </button>
        </div>
      )}
    </div>
  )
}

export { allocationSegments, PortfolioAllocationDonut } from '@/features/terminal-os/portfolio-os/components/PortfolioAllocationDonut'
