'use client'

import '@/lib/dashboard/tokens.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentFeedEvent, UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { ScanResult } from '@/lib/revenue-dashboard/types'
import { SignalSwapSheet } from '@/components/signals-dashboard/SignalSwapSheet'
import { useSignalFeed } from '@/lib/signals-dashboard/use-signal-feed'
import { formatAge } from '@/lib/signals-dashboard/format'
import { buildTickerAlerts } from '@/lib/command-center/alerts'
import {
  computeAlphaFeedStats,
  pickEarlyGems,
  rankHotOpportunities,
  type HotSortKey,
} from '@/lib/command-center/stats'
import { scanResultToFactors, verdictLabel } from '@/lib/command-center/scan-factors'
import { truncateWallet, type TopTradersResult } from '@/lib/command-center/top-traders-types'
import { appToolUrl } from '@/lib/dashboard/app-routes'
import { DASHBOARD_NAV, isDashNavActive } from '@/lib/dashboard/nav'
import { CryptoCheckLogo } from '@/components/brand/CryptoCheckLogo'
import { DataSourcesStrip } from './DataSourcesStrip'
import { FeedConnectionPill } from './primitives/FeedConnectionPill'
import { FeedSectionState } from './primitives/FeedSectionState'
import type { FeedLoadState } from '@/lib/signals-dashboard/feed-load-state'
import { VerifiedTrackRecordPanel } from './VerifiedTrackRecordPanel'
import { SniperPanel } from './SniperPanel'
import {
  Bell,
  ChevronLeft,
  Crown,
  Filter,
  Flame,
  Gem,
  MessageSquare,
  Settings2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react'

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-orange-500 to-red-600',
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-green-600',
  'from-amber-400 to-orange-500',
] as const

export type DashboardNewProps = {
  userEmail: string
  effectiveTier: string
  isAnonymousPreview?: boolean
}

function fmtStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function payloadStr(signal: UnifiedSignal, key: string): string {
  const v = signal.rawPayload?.[key]
  if (v == null || v === '') return '—'
  if (typeof v === 'number') return v.toLocaleString()
  return String(v)
}

function factorTone(word: string): string {
  if (['Low', 'Safe', 'Strong', 'Good'].includes(word)) return 'text-dash-green'
  if (word === 'Moderate') return 'text-dash-amber'
  return 'text-dash-red'
}

function riskWord(verdict: ScanResult['verdict'] | undefined): string {
  if (verdict === 'SAFE') return 'Low Risk'
  if (verdict === 'CAUTION') return 'Moderate Risk'
  if (verdict) return 'High Risk'
  return '—'
}

/* ── Primitives (self-contained) ─────────────────────────────────────────── */

function ScoreRing({ value, size = 44, stroke = 3 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - value / 100)
  const fontSize = size >= 100 ? 'text-[34px]' : size >= 44 ? 'text-[15px]' : 'text-[11px]'

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-dash-innerline" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#dash-new-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="shadow-dash-ring"
        />
        <defs>
          <linearGradient id="dash-new-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--dash-ring-from)" />
            <stop offset="100%" stopColor="var(--dash-ring-to)" />
          </linearGradient>
        </defs>
      </svg>
      <span className={`font-dash-mono absolute font-medium tabular-nums text-dash-green ${fontSize}`}>{value}</span>
    </div>
  )
}

function RankBadge({ n }: { n: number }) {
  const gold = n === 1
  return (
    <span
      className={`font-dash-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        gold ? 'bg-dash-gold text-dash-bg' : 'bg-dash-greenDeep text-dash-green'
      }`}
    >
      {n}
    </span>
  )
}

function Sparkline({ values }: { values?: number[] }) {
  if (!values || values.length < 2) {
    return (
      <svg width={60} height={20} className="text-dash-green" aria-hidden>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          points="0,16 10,12 20,14 30,8 40,10 50,4 60,6"
        />
      </svg>
    )
  }
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 60
      const y = 20 - ((v - min) / range) * 20
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={60} height={20} className="text-dash-green" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} />
    </svg>
  )
}

function fmtStatTileValue(state: FeedLoadState, display: string): string {
  if (state === 'loading') return '…'
  if (state === 'error') return '—'
  return display
}

function TokenAvatar({ label, gradient }: { label: string; gradient: string }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-sm font-bold text-white shadow-inner`}
    >
      {label.slice(0, 1)}
    </span>
  )
}

function SmartMoneyAvatars() {
  return (
    <div className="flex -space-x-1.5">
      {['W', 'A', 'S'].map((l) => (
        <span
          key={l}
          className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-dash-bg bg-dash-greenDeep text-[8px] font-bold text-dash-green"
        >
          {l}
        </span>
      ))}
    </div>
  )
}

function DataCol({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden min-w-[4.25rem] lg:block">
      <p className="text-[11px] text-dash-tlo">{label}</p>
      <p className="font-dash-mono text-[13px] tabular-nums text-dash-thi">{value}</p>
    </div>
  )
}

/* ── Main layout (preview.webp) ──────────────────────────────────────────── */

export function DashboardNew({ userEmail, effectiveTier, isAnonymousPreview }: DashboardNewProps) {
  const pathname = usePathname()
  const premiumToken =
    typeof process.env.NEXT_PUBLIC_SIGNAL_PREMIUM_TOKEN === 'string'
      ? process.env.NEXT_PUBLIC_SIGNAL_PREMIUM_TOKEN
      : undefined

  // Token lane — stats / Hot Opps / Early Gems (server-filtered subject_type=token).
  const {
    signals: tokenSignalsMap,
    connection,
    feedState,
    errorMessage,
    recentIds,
    reload,
  } = useSignalFeed({ subjectType: 'token' }, { premiumToken })

  // Sports lane — ticker edges / TxODDS-related alerts (server-filtered match_event).
  const { signals: sportsSignalsMap } = useSignalFeed(
    { subjectType: 'match_event' },
    { premiumToken },
  )

  const reconnecting = connection === 'reconnecting'
  const feedHandshake = connection === 'connecting' || connection === 'listening'

  const tokenSignals = useMemo(() => [...tokenSignalsMap.values()], [tokenSignalsMap])
  const sportsSignals = useMemo(() => [...sportsSignalsMap.values()], [sportsSignalsMap])
  const stats = useMemo(() => computeAlphaFeedStats(tokenSignals), [tokenSignals])

  const [sort, setSort] = useState<HotSortKey>('score')
  const [filter24h, setFilter24h] = useState(true)
  const hotRows = useMemo(
    () => rankHotOpportunities(tokenSignals, sort, filter24h),
    [tokenSignals, sort, filter24h],
  )
  const gems = useMemo(() => pickEarlyGems(tokenSignals), [tokenSignals])

  const [agentEvents, setAgentEvents] = useState<AgentFeedEvent[]>([])
  useEffect(() => {
    fetch('/api/signals/agent/tape', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const tape = Array.isArray(j.tape) ? j.tape : []
        setAgentEvents(tape.map((t: { event: AgentFeedEvent }) => t.event))
      })
      .catch(() => setAgentEvents([]))
  }, [])

  const tickerAlerts = useMemo(
    () => buildTickerAlerts([...tokenSignals, ...sportsSignals], agentEvents),
    [tokenSignals, sportsSignals, agentEvents],
  )

  const [topTraders, setTopTraders] = useState<TopTradersResult | null>(null)
  useEffect(() => {
    fetch('/api/dashboard/command-center/top-traders', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setTopTraders(j as TopTradersResult))
      .catch(() =>
        setTopTraders({ status: 'soon', reason: 'Leaderboard unlocks with live trading' }),
      )
  }, [])

  const [scan, setScan] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [mintInput, setMintInput] = useState('')
  const [swapSignal, setSwapSignal] = useState<UnifiedSignal | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const runScan = useCallback(async (mint: string) => {
    setScanning(true)
    try {
      const res = await fetch('/api/revenue/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint }),
      })
      const body = await res.json()
      if (res.ok) setScan(body as ScanResult)
    } catch (e) {
      console.error('[dashboard] scan failed', e)
    } finally {
      setScanning(false)
    }
  }, [])

  const onScanRow = useCallback(
    (signal: UnifiedSignal) => {
      const mint = signal.contractAddress?.trim()
      if (mint) void runScan(mint)
    },
    [runScan],
  )

  const onSwap = useCallback((signal: UnifiedSignal) => {
    setSwapSignal(signal)
    setSheetOpen(true)
  }, [])

  const displayName = userEmail ? userEmail.split('@')[0] : 'Guest'
  const tierLabel =
    effectiveTier === 'FREE' ? 'Free Member' : effectiveTier === 'PRO' ? 'Pro Member' : effectiveTier
  const scanFactors = scan ? scanResultToFactors(scan) : null

  const statTiles = [
    {
      label: 'Total Opportunities',
      value: fmtStatTileValue(feedState, fmtStat(stats.totalOpportunities)),
      delta:
        feedState === 'data' && stats.totalOpportunities24h > 0
          ? `+${fmtStat(stats.totalOpportunities24h)} 24h`
          : undefined,
    },
    {
      label: 'Avg AI Score',
      value: fmtStatTileValue(
        feedState,
        stats.avgAiScore != null ? String(stats.avgAiScore) : '—',
      ),
    },
    {
      label: 'Total Mentions',
      value: fmtStatTileValue(feedState, fmtStat(stats.totalMentions)),
      delta:
        feedState === 'data' && stats.totalMentions24h > 0
          ? `+${fmtStat(stats.totalMentions24h)} 24h`
          : undefined,
    },
    {
      label: 'Smart Money Moves',
      value: fmtStatTileValue(feedState, fmtStat(stats.smartMoneyMoves)),
      delta:
        feedState === 'data' && stats.smartMoneyMoves24h > 0
          ? `+${fmtStat(stats.smartMoneyMoves24h)} 24h`
          : undefined,
    },
  ]

  return (
    <div className="min-h-screen bg-dash-bg font-sans text-dash-thi">
      <div className="mx-auto grid min-h-screen grid-cols-1 gap-4 p-4 pb-12 min-[1100px]:grid-cols-[232px_minmax(0,1fr)_320px]">
        {/* ── Sidebar ── */}
        <aside className="flex flex-col rounded-dash border border-dash-hairline bg-dash-panel min-[1100px]:row-span-2 min-[1100px]:min-h-[calc(100vh-2rem)]">
          <div className="relative flex items-center gap-2 border-b border-dash-innerline px-4 py-4">
            <CryptoCheckLogo href="/dashboard" />
            <button
              type="button"
              className="absolute right-2 top-3 rounded-dash-chip border border-dash-innerline p-1 text-dash-tmid transition-colors duration-150 hover:text-dash-thi"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3">
            {DASHBOARD_NAV.map((group) => (
              <div key={group.title} className="mb-4">
                <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.14em] text-dash-tlo">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isDashNavActive(pathname, item.href)
                  const inner = (
                    <>
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-dash-green' : 'text-dash-tlo'}`} />
                      <span className="truncate">{item.label}</span>
                      {item.badge === 'NEW' ? (
                        <span className="ml-auto rounded bg-dash-greenDim px-1.5 py-0.5 text-[9px] font-bold uppercase text-dash-green">
                          NEW
                        </span>
                      ) : null}
                      {item.badge === 'HOT' ? (
                        <span className="ml-auto rounded bg-dash-red px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                          HOT
                        </span>
                      ) : null}
                    </>
                  )
                  const cls = `mb-1 flex items-center gap-3 rounded-dash-pill px-3 py-2 text-[13px] transition-colors duration-150 ${
                    active
                      ? 'bg-dash-greenDim font-medium text-dash-thi'
                      : 'text-dash-tmid hover:bg-dash-panel2 hover:text-dash-thi'
                  }`
                  return item.external ? (
                    <a key={item.label} href={item.href} className={cls}>
                      {inner}
                    </a>
                  ) : (
                    <Link key={item.label} href={item.href} className={cls}>
                      {inner}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>

          <div className="m-3 rounded-dash-inner border border-dash-innerline bg-dash-panel2 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-dash-inner bg-gradient-to-br from-dash-greenDeep to-dash-panel shadow-dash-ring">
                <Sparkles className="h-5 w-5 text-dash-green" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-dash-green">NEURAL V4</p>
                <p className="text-xs text-dash-tmid">The most advanced AI engine in crypto</p>
              </div>
            </div>
            <Link
              href={appToolUrl('neuralv4')}
              className="mt-3 block w-full rounded-dash-chip bg-dash-green py-2 text-center text-xs font-semibold text-dash-bg transition-colors duration-150 hover:bg-dash-greenHi"
            >
              Learn More
            </Link>
          </div>
        </aside>

        {/* ── Center column ── */}
        <div className="flex min-w-0 flex-col gap-4 min-[1100px]:col-start-2">
          {/* Top stats bar */}
          <header className="rounded-dash border border-dash-hairline bg-dash-panel p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-2">
                <MessageSquare className="mt-0.5 h-4 w-4 text-dash-green" />
                <div>
                  <p className="text-[13px] font-semibold text-dash-green">SMART ALPHA FEED</p>
                  <p className="text-xs text-dash-tmid">Real-time opportunities from top crypto channels</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isAnonymousPreview || effectiveTier === 'FREE' ? (
                  <Link
                    href="/app/upgrade"
                    className="inline-flex items-center gap-1.5 rounded-dash-chip border border-dash-gold/50 px-3 py-1.5 text-xs font-semibold text-dash-gold transition-colors duration-150 hover:border-dash-gold"
                  >
                    <Crown className="h-3.5 w-3.5" />
                    Upgrade to Pro
                  </Link>
                ) : null}
                <Link
                  href="/dashboard/alerts"
                  className="relative flex h-9 w-9 items-center justify-center rounded-dash-chip border border-dash-innerline text-dash-tmid transition-colors duration-150 hover:text-dash-thi"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {tickerAlerts.length > 0 ? (
                    <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-dash-green" />
                  ) : null}
                </Link>
                <div className="flex items-center gap-2 rounded-dash-pill border border-dash-innerline bg-dash-panel2 px-3 py-1.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-dash-green to-dash-greenDeep text-xs font-bold text-dash-bg">
                    {displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="hidden sm:block">
                    <p className="max-w-[140px] truncate text-[13px] font-medium text-dash-thi">{displayName}</p>
                    <p className="text-[10px] uppercase text-dash-tlo">{tierLabel}</p>
                  </div>
                </div>
              </div>
            </div>

            {(reconnecting || feedHandshake || feedState === 'error') ? (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                {feedState === 'error' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-dash-pill border border-dash-red/40 bg-dash-red/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-dash-red">
                    Feed offline
                  </span>
                ) : (
                  <FeedConnectionPill state={connection} />
                )}
              </div>
            ) : null}

            {feedState === 'error' ? (
              <p className="mt-3 rounded-dash-inner border border-dash-red/30 bg-dash-red/5 px-3 py-2 text-xs text-dash-tmid">
                {errorMessage ?? 'Signal history API unreachable'} — stats show dashes until the feed recovers.
              </p>
            ) : null}

            <div className="mt-4 flex divide-x divide-dash-innerline overflow-x-auto">
              {statTiles.map((s) => (
                <div key={s.label} className="min-w-[7rem] flex-1 px-4 py-1 first:pl-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-dash-tlo">{s.label}</p>
                  <p className="font-dash-mono mt-1 text-[22px] font-semibold tabular-nums text-dash-thi">{s.value}</p>
                  {s.delta ? (
                    <p className="font-dash-mono mt-0.5 text-[10px] text-dash-green">{s.delta}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </header>

          <DataSourcesStrip />

          {/* Hot opportunities */}
          <section id="hot-opportunities" className="rounded-dash border border-dash-hairline bg-dash-panel">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-dash-innerline px-4 py-3 md:px-5">
              <div className="flex items-start gap-2">
                <Flame className="mt-0.5 h-4 w-4 text-dash-green" />
                <div>
                  <p className="text-[13px] font-semibold text-dash-green">HOT OPPORTUNITIES</p>
                  <p className="text-xs text-dash-tmid">Real-time AI-ranked opportunities</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as HotSortKey)}
                  className="font-dash-mono rounded-dash-chip border border-dash-innerline bg-dash-inset px-2 py-1 text-[11px] text-dash-tmid"
                >
                  <option value="score">AI Score</option>
                  <option value="age">Age</option>
                  <option value="liquidity">Liquidity</option>
                </select>
                <button
                  type="button"
                  onClick={() => setFilter24h((v) => !v)}
                  className={`font-dash-mono rounded-dash-chip border px-2 py-1 text-[11px] ${
                    filter24h
                      ? 'border-dash-green/40 bg-dash-greenDim text-dash-green'
                      : 'border-dash-innerline text-dash-tmid'
                  }`}
                >
                  24H
                </button>
                <button type="button" className="rounded-dash-chip border border-dash-innerline p-1.5 text-dash-tlo">
                  <Filter className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 p-3 md:p-4">
              <FeedSectionState
                state={feedState === 'data' && hotRows.length === 0 ? 'empty' : feedState}
                errorMessage={errorMessage ?? undefined}
                onRetry={() => void reload()}
                emptyMessage="Listening for opportunities…"
                loadingSkeleton={
                  <>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-[72px] animate-shimmer rounded-dash-inner bg-dash-panel2" />
                    ))}
                  </>
                }
              >
                {hotRows.slice(0, 8).map((signal, idx) => {
                  const label = signal.label || signal.contractAddress?.slice(0, 6) || 'Token'
                  const score = Math.round(signal.scoreValue ?? 0)
                  const smartCount = signal.sourceCount ?? 0
                  const isRecent = recentIds.has(signal.id)
                  const gradient = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
                  return (
                    <article
                      key={signal.id}
                      className={`flex flex-wrap items-center gap-3 rounded-dash-inner border border-dash-innerline bg-dash-panel2 px-3 py-3 transition-colors duration-150 hover:bg-dash-inset ${
                        isRecent ? 'ring-1 ring-dash-green/30' : ''
                      }`}
                    >
                      <RankBadge n={idx + 1} />
                      <div className="flex min-w-[130px] flex-1 items-center gap-2">
                        <TokenAvatar label={label} gradient={gradient} />
                        <div>
                          <p className="text-[13px] font-semibold text-dash-thi">{label}</p>
                          <p className="text-[11px] text-dash-tmid">{signal.contractAddress?.slice(0, 8) ?? '—'}…</p>
                        </div>
                      </div>
                      <DataCol label="Market Cap" value={payloadStr(signal, 'marketCap')} />
                      <DataCol label="Liquidity" value={payloadStr(signal, 'liquidity')} />
                      <DataCol label="Age" value={formatAge(signal.msgTimestamp)} />
                      <DataCol label="Holders" value={payloadStr(signal, 'holders')} />
                      <div className="hidden min-w-[5rem] lg:block">
                        <p className="text-[11px] text-dash-tlo">Smart Money</p>
                        <div className="mt-1 flex items-center gap-1">
                          {smartCount > 0 ? <SmartMoneyAvatars /> : null}
                          <span className="font-dash-mono text-[11px] text-dash-tlo">
                            {smartCount > 0 ? smartCount : '—'}
                          </span>
                        </div>
                      </div>
                      <DataCol label="Mentions" value={String(signal.sourceCount ?? '—')} />
                      <div className="flex flex-col items-center">
                        <ScoreRing value={score} size={44} stroke={3} />
                        <span className="mt-0.5 text-[10px] text-dash-tlo">AI Score</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => onScanRow(signal)}
                          className="inline-flex items-center justify-center gap-1 rounded-dash-chip border border-dash-hairline px-3 py-1.5 text-xs font-medium text-dash-tmid transition-colors duration-150 hover:border-white/20 hover:bg-dash-panel"
                        >
                          <SlidersHorizontal className="h-3 w-3" />
                          Scan
                        </button>
                        <button
                          type="button"
                          onClick={() => onSwap(signal)}
                          disabled={signal.verdict === 'danger'}
                          className="inline-flex items-center justify-center gap-1 rounded-dash-chip bg-dash-green px-3 py-1.5 text-xs font-bold text-dash-bg transition-colors duration-150 hover:bg-dash-greenHi disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Zap className="h-3 w-3" />
                          Swap
                        </button>
                      </div>
                    </article>
                  )
                })}
              </FeedSectionState>
            </div>

            <footer className="border-t border-dash-innerline py-3 text-center">
              <Link
                href="/dashboard/signals"
                className="text-xs font-semibold text-dash-green hover:text-dash-greenHi hover:underline"
              >
                View All Opportunities
              </Link>
            </footer>
          </section>

          {/* Early gems */}
          <section id="early-gems" className="rounded-dash border border-dash-hairline bg-dash-panel p-4 md:p-5">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-start gap-2">
                <Gem className="mt-0.5 h-4 w-4 text-dash-green" />
                <div>
                  <p className="text-[13px] font-semibold text-dash-green">EARLY GEM DETECTOR</p>
                  <p className="text-xs text-dash-tmid">High potential tokens before they explode</p>
                </div>
              </div>
              <Link href="/dashboard/signals" className="text-xs text-dash-green hover:underline">
                View All
              </Link>
            </div>
            <FeedSectionState
              state={
                feedState === 'data' && gems.length === 0
                  ? 'empty'
                  : feedState
              }
              errorMessage={errorMessage ?? undefined}
              onRetry={() => void reload()}
              emptyMessage="No early gems detected yet."
              loadingSkeleton={
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-28 animate-shimmer rounded-dash-inner bg-dash-panel2" />
                  ))}
                </div>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {gems.slice(0, 4).map((g) => {
                  const label = g.label || 'Token'
                  const score = Math.round(g.scoreValue ?? 0)
                  return (
                    <article
                      key={g.id}
                      className="rounded-dash-inner border border-dash-innerline bg-dash-panel2 p-3 transition-colors duration-150 hover:bg-dash-inset"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-dash-greenDeep text-xs font-bold text-dash-green">
                            {label.slice(0, 1)}
                          </span>
                          <p className="text-[13px] font-semibold text-dash-thi">{label}</p>
                        </div>
                        <ScoreRing value={score} size={36} stroke={3} />
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <dt className="text-[10px] text-dash-tlo">Age</dt>
                          <dd className="font-dash-mono text-[11px] text-dash-thi">{formatAge(g.msgTimestamp)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-dash-tlo">Mcap</dt>
                          <dd className="font-dash-mono text-[11px] text-dash-thi">{payloadStr(g, 'marketCap')}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-dash-tlo">Liquidity</dt>
                          <dd className="font-dash-mono text-[11px] text-dash-thi">{payloadStr(g, 'liquidity')}</dd>
                        </div>
                      </dl>
                    </article>
                  )
                })}
              </div>
            </FeedSectionState>
          </section>
        </div>

        {/* ── Right rail ── */}
        <aside className="flex min-w-0 flex-col gap-4 min-[1100px]:col-start-3 min-[1100px]:row-start-1">
          {/* AI scanner */}
          <section className="rounded-dash border border-dash-hairline bg-dash-panel p-4 md:p-5">
            <div className="mb-4 flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 text-dash-green" />
              <div>
                <p className="text-[13px] font-semibold text-dash-green">AI TOKEN SCANNER</p>
                <p className="text-[11px] text-dash-tmid">Powered by Neural V4</p>
              </div>
            </div>

            {scanning ? (
              <div className="flex flex-col items-center py-8">
                <div className="h-[110px] w-[110px] animate-shimmer rounded-full bg-dash-panel2" />
                <p className="mt-4 text-xs text-dash-tmid">Scanning on-chain intelligence…</p>
              </div>
            ) : scan ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex flex-col items-center">
                  <ScoreRing value={scan.safetyScore} size={110} stroke={6} />
                  <p className="font-dash-mono mt-1 text-[11px] text-dash-tlo">/100</p>
                  <p className="font-dash-mono text-[11px] uppercase text-dash-tmid">{riskWord(scan.verdict)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-dash-tlo">AI Verdict</p>
                  <p className="text-base font-semibold text-dash-thi">{verdictLabel(scan.verdict)}</p>
                  <div className="mt-3 border-t border-dash-innerline pt-2">
                    {scanFactors?.map((f) => (
                      <div key={f.label} className="flex items-center gap-2 py-1.5 text-xs">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-dash-green" />
                        <span className="shrink-0 text-[12px] text-dash-tmid">{f.label}</span>
                        <span className="min-w-0 flex-1 border-b border-dotted border-dash-innerline" />
                        <span className={`shrink-0 text-[12px] font-medium ${factorTone(f.status)}`}>{f.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center opacity-70">
                <ScoreRing value={0} size={100} stroke={6} />
                <p className="mt-4 text-sm text-dash-tmid">Scan a token to analyze</p>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <input
                type="text"
                value={mintInput}
                onChange={(e) => setMintInput(e.target.value)}
                placeholder="Paste Solana mint address…"
                className="font-dash-mono w-full rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-2 text-xs text-dash-thi placeholder:text-dash-tlo focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
              />
              <button
                type="button"
                onClick={() => {
                  const m = mintInput.trim()
                  if (m.length >= 32) void runScan(m)
                }}
                disabled={scanning || mintInput.trim().length < 32}
                className="w-full rounded-dash-chip bg-dash-green py-2.5 text-xs font-bold uppercase tracking-wider text-dash-bg transition-colors duration-150 hover:bg-dash-greenHi disabled:cursor-not-allowed disabled:opacity-50"
              >
                Scan Any Token
              </button>
            </div>
          </section>

          <SniperPanel />

          <VerifiedTrackRecordPanel />

          {/* Top smart money */}
          <section className="rounded-dash border border-dash-hairline bg-dash-panel p-4 md:p-5">
            <header className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-dash-green">TOP SMART MONEY</p>
                <p className="text-[11px] text-dash-tmid">Last 30 Days</p>
              </div>
              <Link href={appToolUrl('whales')} className="text-xs text-dash-tlo hover:text-dash-thi">
                View All
              </Link>
            </header>
            {!topTraders ? (
              <ul className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="h-10 animate-shimmer rounded-dash-inner bg-dash-panel2" />
                ))}
              </ul>
            ) : topTraders.status === 'soon' ? (
              <div className="rounded-dash-inner border border-dashed border-dash-innerline px-4 py-8 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-dash-amber">Soon</p>
                <p className="mt-2 text-xs text-dash-tmid">{topTraders.reason}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {topTraders.traders.slice(0, 5).map((w) => (
                  <li
                    key={w.walletAddress}
                    className="flex items-center gap-2 rounded-dash-inner border border-dash-innerline px-2 py-2 transition-colors duration-150 hover:bg-dash-panel2"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-dash-greenDeep text-[10px] font-bold text-dash-green">
                      {w.rank}
                    </span>
                    <span className="font-dash-mono min-w-0 flex-1 truncate text-xs text-dash-thi">
                      {truncateWallet(w.walletAddress)}
                    </span>
                    <span className="font-dash-mono text-xs font-semibold text-dash-green">
                      ${w.volumeUsd.toLocaleString()}
                    </span>
                    <Sparkline values={w.sparkline} />
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={appToolUrl('whales')}
              className="mt-4 block w-full rounded-dash-chip border border-dash-hairline py-2 text-center text-xs font-semibold text-dash-tmid transition-colors duration-150 hover:border-white/20 hover:bg-dash-panel2 hover:text-dash-thi"
            >
              Track Smart Money
            </Link>
          </section>
        </aside>

        {/* Alerts ticker — spans center + right */}
        <footer className="flex h-10 items-center border-t border-dash-hairline bg-dash-panel min-[1100px]:col-span-2 min-[1100px]:col-start-2 min-[1100px]:row-start-2">
          <span className="ml-4 flex shrink-0 items-center gap-1.5 rounded-dash-pill bg-dash-greenDim px-2 py-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-dash-green">Alerts</span>
            <span className="font-dash-mono text-[11px] font-semibold text-dash-green">{tickerAlerts.length}</span>
          </span>
          <div className="relative mx-4 min-w-0 flex-1 overflow-hidden">
            {tickerAlerts.length === 0 ? (
              <p className="text-xs text-dash-tlo">No live alerts yet — feed updates appear here.</p>
            ) : (
              <div className="flex gap-8 whitespace-nowrap motion-safe:animate-ticker-slow motion-reduce:animate-none hover:[animation-play-state:paused]">
                {[...tickerAlerts, ...tickerAlerts].map((a, i) => (
                  <span key={`${a.id}-${i}`} className="inline-flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-dash-green" />
                    <span className="text-dash-tmid">{a.text}</span>
                    <span className="font-dash-mono text-dash-tlo">· {a.ago} ago</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <Link href="/dashboard/alerts" className="mr-4 shrink-0 text-[11px] font-semibold text-dash-green hover:underline">
            View All Alerts
          </Link>
        </footer>
      </div>

      <SignalSwapSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        signal={swapSignal}
      />
    </div>
  )
}
