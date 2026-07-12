'use client'

import '@/lib/dashboard/tokens.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type ReactNode, type ComponentType } from 'react'
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
  Gem,
  Search,
  Shield,
  SlidersHorizontal,
  Zap,
} from 'lucide-react'

type AccentKey = 'green' | 'blue' | 'orange'

const ACCENT: Record<
  AccentKey,
  { text: string; border: string; bg: string; glow: string; stroke: string; iconBg: string }
> = {
  green: {
    text: 'text-dash-green',
    border: 'border-dash-green/35',
    bg: 'bg-dash-greenDim',
    glow: 'shadow-dash-glow-emerald',
    stroke: '#22C55E',
    iconBg: 'bg-dash-green/15',
  },
  blue: {
    text: 'text-dash-sky',
    border: 'border-dash-sky/35',
    bg: 'bg-dash-sky/10',
    glow: 'shadow-dash-glow-blue',
    stroke: '#3B82F6',
    iconBg: 'bg-dash-sky/15',
  },
  orange: {
    text: 'text-dash-gold',
    border: 'border-dash-gold/40',
    bg: 'bg-dash-gold/10',
    glow: 'shadow-dash-glow-gold',
    stroke: '#F97316',
    iconBg: 'bg-dash-gold/15',
  },
}

const SCORE_ORANGE = '#F97316'

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
  if (word === 'Moderate') return 'text-dash-gold'
  return 'text-dash-red'
}

function riskWord(verdict: ScanResult['verdict'] | undefined): string {
  if (verdict === 'SAFE') return 'Low Risk'
  if (verdict === 'CAUTION') return 'Moderate Risk'
  if (verdict) return 'High Risk'
  return '—'
}

/* ── Primitives ──────────────────────────────────────────────────────────── */

function ScoreRing({
  value,
  size = 44,
  stroke = 3,
}: {
  value: number
  size?: number
  stroke?: number
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(100, Math.max(0, value)) / 100)
  const fontSize = size >= 100 ? 'text-[34px]' : size >= 44 ? 'text-[15px]' : 'text-[11px]'
  const gradId = `dash-ring-orange-${size}-${Math.round(value)}`

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-white/10"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 4px ${SCORE_ORANGE}88)` }}
        />
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={SCORE_ORANGE} />
            <stop offset="100%" stopColor="#FB923C" />
          </linearGradient>
        </defs>
      </svg>
      <span className={`font-dash-mono absolute font-semibold tabular-nums text-dash-gold ${fontSize}`}>
        {value}
      </span>
    </div>
  )
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  accent = 'green',
  action,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  subtitle: string
  accent?: AccentKey
  action?: ReactNode
}) {
  const a = ACCENT[accent]
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-dash-chip border ${a.iconBg} ${a.border}`}
        >
          <Icon className={`h-4 w-4 ${a.text}`} />
        </span>
        <div>
          <p className={`font-space text-[13px] font-semibold tracking-wide ${a.text}`}>{title}</p>
          <p className="mt-0.5 text-xs text-dash-tmid">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

function MetricCard({
  label,
  value,
  delta,
  accent,
}: {
  label: string
  value: string
  delta?: string
  accent: AccentKey
}) {
  const a = ACCENT[accent]
  return (
    <div className="dash-glass relative min-w-[9.5rem] flex-1 overflow-hidden rounded-dash border border-dash-hairline px-4 py-4">
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 w-full opacity-30"
        viewBox="0 0 120 40"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polyline
          fill="none"
          stroke={a.stroke}
          strokeWidth="1.5"
          points="0,32 15,28 30,30 45,18 60,22 75,10 90,14 105,6 120,12"
        />
      </svg>
      <p className={`font-dash-mono relative text-[28px] font-semibold tabular-nums tracking-tight ${a.text}`}>
        {value}
      </p>
      <p className="relative mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-dash-tlo">
        {label}
      </p>
      {delta ? (
        <p className={`relative mt-1 font-dash-mono text-[10px] font-medium ${a.text}`}>{delta}</p>
      ) : null}
    </div>
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

function TokenAvatar({ label }: { label: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dash-green/30 bg-dash-green/15 text-sm font-bold text-dash-green">
      {label.slice(0, 1).toUpperCase()}
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

function scrollToHot() {
  document.getElementById('hot-opportunities')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ── Main layout (NORO Marketplace) ──────────────────────────────────────── */

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
  const [filterSafe, setFilterSafe] = useState(false)
  const hotRows = useMemo(() => {
    const ranked = rankHotOpportunities(tokenSignals, sort, filter24h)
    if (!filterSafe) return ranked
    return ranked.filter((s) => s.verdict === 'safe')
  }, [tokenSignals, sort, filter24h, filterSafe])
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
  const showUpgrade = isAnonymousPreview || effectiveTier === 'FREE'

  const metricTiles: Array<{
    label: string
    value: string
    delta?: string
    accent: AccentKey
  }> = [
    {
      label: 'Total Opportunities',
      value: fmtStatTileValue(feedState, fmtStat(stats.totalOpportunities)),
      delta:
        feedState === 'data' && stats.totalOpportunities24h > 0
          ? `↑ ${fmtStat(stats.totalOpportunities24h)} 24h`
          : undefined,
      accent: 'green',
    },
    {
      label: 'Avg AI Score',
      value: fmtStatTileValue(
        feedState,
        stats.avgAiScore != null ? String(stats.avgAiScore) : '—',
      ),
      accent: 'blue',
    },
    {
      label: 'Total Mentions',
      value: fmtStatTileValue(feedState, fmtStat(stats.totalMentions)),
      delta:
        feedState === 'data' && stats.totalMentions24h > 0
          ? `↑ ${fmtStat(stats.totalMentions24h)} 24h`
          : undefined,
      accent: 'orange',
    },
    {
      label: 'Smart Money',
      value: fmtStatTileValue(feedState, fmtStat(stats.smartMoneyMoves)),
      delta:
        feedState === 'data' && stats.smartMoneyMoves24h > 0
          ? `↑ ${fmtStat(stats.smartMoneyMoves24h)} 24h`
          : undefined,
      accent: 'green',
    },
  ]

  return (
    <div className="dash-atmosphere min-h-screen font-sans text-dash-thi">
      <div className="mx-auto grid min-h-screen grid-cols-1 gap-4 p-4 pb-12 min-[1100px]:grid-cols-[232px_minmax(0,1fr)_320px]">
        {/* ── Left sidebar ── */}
        <aside className="dash-glass flex flex-col rounded-dash border border-dash-hairline min-[1100px]:row-span-2 min-[1100px]:min-h-[calc(100vh-2rem)]">
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
                <p className="mb-2 px-2 font-space text-[11px] font-medium uppercase tracking-[0.14em] text-dash-tlo">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isDashNavActive(pathname, item.href)
                  const inner = (
                    <>
                      <Icon
                        className={`h-4 w-4 shrink-0 ${active ? 'text-dash-green' : 'text-dash-tlo'}`}
                      />
                      <span className="truncate">{item.label}</span>
                      {item.badge === 'NEW' ? (
                        <span className="ml-auto rounded border border-dash-green/40 bg-dash-green/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-dash-green">
                          NEW
                        </span>
                      ) : null}
                      {item.badge === 'HOT' ? (
                        <span className="ml-auto rounded border border-dash-gold/40 bg-dash-gold/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-dash-gold">
                          HOT
                        </span>
                      ) : null}
                    </>
                  )
                  const cls = `relative mb-1 flex items-center gap-3 rounded-r-dash-chip px-3 py-2 text-[13px] transition-colors duration-150 ${
                    active
                      ? 'bg-dash-green/10 font-medium text-dash-green'
                      : 'text-dash-tmid hover:bg-dash-panel2 hover:text-dash-thi'
                  }`
                  return item.external ? (
                    <a key={item.label} href={item.href} className={cls}>
                      {active ? (
                        <span className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r bg-dash-green" />
                      ) : null}
                      {inner}
                    </a>
                  ) : (
                    <Link key={item.label} href={item.href} className={cls}>
                      {active ? (
                        <span className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r bg-dash-green" />
                      ) : null}
                      {inner}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>

          <div className="m-3 rounded-dash-inner border border-dash-hairline bg-dash-panel2 p-3">
            <p className="font-space text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-gold">
              Deal Flow Access
            </p>
            <p className="mt-1 text-xs text-dash-tmid">
              Unlock Investor Pro signals, curated deal flow, and priority scan throughput.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/app/upgrade"
                className="block w-full rounded-dash-chip bg-dash-gold py-2 text-center text-xs font-bold text-dash-bg noro-glow-orange transition-opacity duration-150 hover:opacity-90"
              >
                Upgrade Pro
              </Link>
              <Link
                href="/app/upgrade"
                className="block w-full rounded-dash-chip border border-dash-sky py-2 text-center text-xs font-semibold text-dash-sky transition-colors duration-150 hover:bg-dash-sky/10"
              >
                Premium
              </Link>
            </div>
          </div>
        </aside>

        {/* ── Center column ── */}
        <div className="flex min-w-0 flex-col gap-4 min-[1100px]:col-start-2">
          {/* Top bar */}
          <header className="dash-glass flex flex-wrap items-center justify-between gap-3 rounded-dash border border-dash-hairline px-4 py-3 md:px-5">
            <div className="min-w-0">
              <p className="font-space text-[15px] font-semibold tracking-wide text-dash-thi">
                CryptoCheck <span className="text-dash-tlo">|</span> Alpha Feed
              </p>
              {(reconnecting || feedHandshake || feedState === 'error') && (
                <div className="mt-1">
                  {feedState === 'error' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-dash-pill border border-dash-red/40 bg-dash-red/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-dash-red">
                      Feed offline
                    </span>
                  ) : (
                    <FeedConnectionPill state={connection} />
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden items-center gap-2 rounded-dash-chip border border-dash-innerline bg-dash-inset px-3 py-1.5 text-dash-tlo sm:flex">
                <Search className="h-3.5 w-3.5" />
                <span className="text-xs">Search opportunities…</span>
              </div>
              {showUpgrade ? (
                <Link
                  href="/app/upgrade"
                  className="inline-flex items-center gap-1.5 rounded-dash-chip bg-dash-gold px-3 py-1.5 text-xs font-bold text-dash-bg noro-glow-orange transition-opacity duration-150 hover:opacity-90"
                >
                  <Crown className="h-3.5 w-3.5" />
                  Upgrade
                </Link>
              ) : null}
              <Link
                href="/dashboard/alerts"
                className="relative flex h-9 w-9 items-center justify-center rounded-dash-chip border border-dash-innerline text-dash-tmid transition-colors duration-150 hover:border-dash-green/40 hover:text-dash-green"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {tickerAlerts.length > 0 ? (
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-dash-gold" />
                ) : null}
              </Link>
              <div className="flex items-center gap-2 rounded-dash-pill border border-dash-innerline bg-dash-panel2 px-3 py-1.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-dash-green/20 text-xs font-bold text-dash-green">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
                <div className="hidden sm:block">
                  <p className="max-w-[140px] truncate text-[13px] font-medium text-dash-thi">
                    {displayName}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-dash-tlo">{tierLabel}</p>
                </div>
              </div>
            </div>
          </header>

          {feedState === 'error' ? (
            <p className="rounded-dash-inner border border-dash-red/30 bg-dash-red/5 px-3 py-2 text-xs text-dash-tmid">
              {errorMessage ?? 'Signal history API unreachable'} — stats show dashes until the feed recovers.
            </p>
          ) : null}

          {/* Hero */}
          <section className="dash-glass rounded-dash border border-dash-hairline px-5 py-8 md:px-8 md:py-10">
            <span className="inline-flex rounded-dash-pill border border-dash-hairline px-3 py-1 font-space text-[10px] font-semibold uppercase tracking-[0.16em] text-dash-tmid">
              The Smart Alpha Marketplace
            </span>
            <h1 className="mt-4 max-w-xl font-space text-3xl font-semibold tracking-tight text-dash-thi md:text-4xl">
              Discover. Analyze.{' '}
              <span className="text-dash-sky">Invest</span> in alpha.
            </h1>
            <p className="mt-3 max-w-lg text-sm text-dash-tmid">
              Verified opportunities from multi-source intelligence — scan, score, and execute with
              risk-gated swaps.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={scrollToHot}
                className="inline-flex items-center gap-2 rounded-dash-chip bg-dash-green px-5 py-2.5 text-sm font-bold text-dash-bg noro-glow-green transition-opacity duration-150 hover:opacity-90"
              >
                Explore Opportunities →
              </button>
              <Link
                href="/dashboard/signals"
                className="inline-flex items-center gap-2 rounded-dash-chip border border-dash-hairline px-5 py-2.5 text-sm font-semibold text-dash-thi transition-colors duration-150 hover:border-dash-green/40 hover:text-dash-green"
              >
                View Signals
              </Link>
            </div>
          </section>

          {/* Metric cards */}
          <div className="flex flex-wrap gap-3">
            {metricTiles.map((s) => (
              <MetricCard
                key={s.label}
                label={s.label}
                value={s.value}
                delta={s.delta}
                accent={s.accent}
              />
            ))}
          </div>

          {/* Thin upgrade banner */}
          {showUpgrade ? (
            <div className="dash-glass flex flex-wrap items-center justify-between gap-3 rounded-dash border border-dash-hairline px-4 py-3">
              <p className="text-sm text-dash-tmid">
                <span className="font-semibold text-dash-thi">Investor Pro</span> — unlock featured deal
                flow and higher signal throughput.
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href="/app/upgrade"
                  className="rounded-dash-pill bg-dash-gold px-4 py-1.5 text-xs font-bold text-dash-bg transition-opacity duration-150 hover:opacity-90"
                >
                  Upgrade Pro
                </Link>
                <Link
                  href="/app/upgrade"
                  className="rounded-dash-pill border border-dash-sky px-4 py-1.5 text-xs font-semibold text-dash-sky transition-colors duration-150 hover:bg-dash-sky/10"
                >
                  Premium
                </Link>
              </div>
            </div>
          ) : null}

          <DataSourcesStrip />

          {/* Hot opportunities — data table */}
          <section
            id="hot-opportunities"
            className="dash-glass overflow-hidden rounded-dash border border-dash-hairline"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dash-innerline px-4 py-3 md:px-5">
              <div>
                <p className="font-space text-[15px] font-semibold text-dash-thi">
                  Top verified opportunities
                </p>
                <p className="mt-0.5 text-xs text-dash-tmid">Real-time AI-ranked token signals</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilter24h((v) => !v)}
                  className={`font-dash-mono rounded-dash-pill border px-3 py-1 text-[11px] ${
                    filter24h
                      ? 'border-dash-green/40 bg-dash-green/10 text-dash-green'
                      : 'border-dash-innerline text-dash-tmid'
                  }`}
                >
                  24H
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilter24h(false)
                    setFilterSafe(false)
                  }}
                  className={`font-dash-mono rounded-dash-pill border px-3 py-1 text-[11px] ${
                    !filter24h && !filterSafe
                      ? 'border-dash-green/40 bg-dash-green/10 text-dash-green'
                      : 'border-dash-innerline text-dash-tmid'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSafe((v) => !v)}
                  className={`font-dash-mono rounded-dash-pill border px-3 py-1 text-[11px] ${
                    filterSafe
                      ? 'border-dash-green/40 bg-dash-green/10 text-dash-green'
                      : 'border-dash-innerline text-dash-tmid'
                  }`}
                >
                  Safe
                </button>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as HotSortKey)}
                  className="font-dash-mono rounded-dash-chip border border-dash-innerline bg-dash-inset px-2 py-1 text-[11px] text-dash-tmid"
                >
                  <option value="score">AI Score</option>
                  <option value="age">Age</option>
                  <option value="liquidity">Liquidity</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <FeedSectionState
                state={feedState === 'data' && hotRows.length === 0 ? 'empty' : feedState}
                errorMessage={errorMessage ?? undefined}
                onRetry={() => void reload()}
                emptyMessage="Listening for opportunities…"
                loadingSkeleton={
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-12 animate-shimmer rounded-dash-inner bg-dash-panel2" />
                    ))}
                  </div>
                }
              >
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-dash-innerline text-[11px] uppercase tracking-[0.12em] text-dash-tlo">
                      <th className="px-4 py-3 font-medium md:px-5">Token</th>
                      <th className="px-3 py-3 font-medium">Sources</th>
                      <th className="px-3 py-3 font-medium">Age</th>
                      <th className="px-3 py-3 font-medium">Mentions</th>
                      <th className="px-3 py-3 font-medium">AI Score</th>
                      <th className="px-4 py-3 font-medium md:px-5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotRows.slice(0, 8).map((signal, idx) => {
                      const label = signal.label || signal.contractAddress?.slice(0, 6) || 'Token'
                      const score = Math.round(signal.scoreValue ?? 0)
                      const smartCount = signal.sourceCount ?? 0
                      const isRecent = recentIds.has(signal.id)
                      const featured = score >= 80 || idx < 2
                      const isSafe = signal.verdict === 'safe'
                      return (
                        <tr
                          key={signal.id}
                          className={`border-b border-dash-innerline transition-colors duration-150 hover:bg-dash-panel2/80 ${
                            isRecent ? 'bg-dash-green/5' : ''
                          }`}
                        >
                          <td className="px-4 py-3 md:px-5">
                            <div className="flex items-center gap-2.5">
                              <TokenAvatar label={label} />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="truncate text-[13px] font-semibold text-dash-thi">
                                    {label}
                                  </p>
                                  {featured ? (
                                    <span className="rounded border border-dash-gold/40 bg-dash-gold/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-dash-gold">
                                      Featured
                                    </span>
                                  ) : null}
                                  {isSafe ? (
                                    <span className="rounded border border-dash-green/40 bg-dash-green/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-dash-green">
                                      Safe
                                    </span>
                                  ) : null}
                                </div>
                                <p className="font-dash-mono text-[11px] text-dash-tmid">
                                  {signal.contractAddress?.slice(0, 8) ?? '—'}…
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              {smartCount > 0 ? <SmartMoneyAvatars /> : null}
                              <span className="font-dash-mono text-[12px] text-dash-tmid">
                                {smartCount > 0 ? smartCount : '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-dash-mono text-[12px] tabular-nums text-dash-thi">
                              {formatAge(signal.msgTimestamp)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-dash-mono text-[12px] tabular-nums text-dash-thi">
                              {String(signal.sourceCount ?? '—')}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <ScoreRing value={score} size={40} stroke={3} />
                          </td>
                          <td className="px-4 py-3 md:px-5">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onScanRow(signal)}
                                className="inline-flex items-center justify-center gap-1 rounded-dash-chip border border-dash-sky/40 px-2.5 py-1.5 text-xs font-medium text-dash-sky transition-colors duration-150 hover:bg-dash-sky/10"
                              >
                                <SlidersHorizontal className="h-3 w-3" />
                                Scan
                              </button>
                              <button
                                type="button"
                                onClick={() => onSwap(signal)}
                                disabled={signal.verdict === 'danger'}
                                className="inline-flex items-center justify-center gap-1 rounded-dash-chip bg-dash-green px-2.5 py-1.5 text-xs font-bold text-dash-bg transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Zap className="h-3 w-3" />
                                Swap
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </FeedSectionState>
            </div>

            <footer className="border-t border-dash-innerline py-3 text-center">
              <Link
                href="/dashboard/signals"
                className="text-xs font-semibold text-dash-green hover:underline"
              >
                View All Opportunities
              </Link>
            </footer>
          </section>

          {/* Early gems — secondary grid */}
          <section
            id="early-gems"
            className="dash-glass rounded-dash border border-dash-hairline p-4 md:p-5"
          >
            <div className="mb-4">
              <SectionHeading
                icon={Gem}
                title="Early Gem Detector"
                subtitle="High potential tokens before they explode"
                accent="orange"
                action={
                  <Link
                    href="/dashboard/signals"
                    className="text-xs font-semibold text-dash-gold hover:underline"
                  >
                    View All
                  </Link>
                }
              />
            </div>
            <FeedSectionState
              state={feedState === 'data' && gems.length === 0 ? 'empty' : feedState}
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
                      className="rounded-dash-inner border border-dash-hairline bg-dash-panel2 p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-dash-gold/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <TokenAvatar label={label} />
                          <p className="text-[13px] font-semibold text-dash-thi">{label}</p>
                        </div>
                        <ScoreRing value={score} size={36} stroke={3} />
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <dt className="text-[10px] text-dash-tlo">Age</dt>
                          <dd className="font-dash-mono text-[11px] text-dash-thi">
                            {formatAge(g.msgTimestamp)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-dash-tlo">Mcap</dt>
                          <dd className="font-dash-mono text-[11px] text-dash-thi">
                            {payloadStr(g, 'marketCap')}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-dash-tlo">Liquidity</dt>
                          <dd className="font-dash-mono text-[11px] text-dash-thi">
                            {payloadStr(g, 'liquidity')}
                          </dd>
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
          <section className="dash-glass rounded-dash border border-dash-hairline p-4 md:p-5">
            <div className="mb-4">
              <SectionHeading
                icon={Shield}
                title="AI Token Scanner"
                subtitle="Powered by Neural V4"
                accent="blue"
              />
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
                  <p className="font-dash-mono text-[11px] uppercase text-dash-tmid">
                    {riskWord(scan.verdict)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-dash-tlo">AI Verdict</p>
                  <p className="font-space text-base font-semibold text-dash-thi">
                    {verdictLabel(scan.verdict)}
                  </p>
                  <div className="mt-3 border-t border-dash-innerline pt-2">
                    {scanFactors?.map((f) => (
                      <div key={f.label} className="flex items-center gap-2 py-1.5 text-xs">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-dash-green" />
                        <span className="shrink-0 text-[12px] text-dash-tmid">{f.label}</span>
                        <span className="min-w-0 flex-1 border-b border-dotted border-dash-innerline" />
                        <span className={`shrink-0 text-[12px] font-medium ${factorTone(f.status)}`}>
                          {f.status}
                        </span>
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
                className="w-full rounded-dash-chip bg-dash-green py-2.5 text-xs font-bold uppercase tracking-wider text-dash-bg noro-glow-green transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Scan Any Token
              </button>
            </div>
          </section>

          <SniperPanel />

          <VerifiedTrackRecordPanel />

          <section className="dash-glass rounded-dash border border-dash-hairline p-4 md:p-5">
            <header className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-space text-[13px] font-semibold text-dash-gold">Top Smart Money</p>
                <p className="text-[11px] text-dash-tmid">Last 30 Days</p>
              </div>
              <Link href={appToolUrl('whales')} className="text-xs text-dash-tlo hover:text-dash-gold">
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
              <div className="rounded-dash-inner border border-dashed border-dash-gold/30 px-4 py-8 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-dash-gold">Soon</p>
                <p className="mt-2 text-xs text-dash-tmid">{topTraders.reason}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {topTraders.traders.slice(0, 5).map((w) => (
                  <li
                    key={w.walletAddress}
                    className="flex items-center gap-2 rounded-dash-inner border border-dash-innerline px-2 py-2 transition-colors duration-150 hover:border-dash-gold/30 hover:bg-dash-panel2"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-dash-gold/15 text-[10px] font-bold text-dash-gold">
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
              className="mt-4 block w-full rounded-dash-chip border border-dash-gold/30 py-2 text-center text-xs font-semibold text-dash-gold transition-colors duration-150 hover:bg-dash-gold/10"
            >
              Track Smart Money
            </Link>
          </section>
        </aside>

        {/* Alerts ticker */}
        <footer className="dash-glass flex h-10 items-center border border-dash-hairline min-[1100px]:col-span-2 min-[1100px]:col-start-2 min-[1100px]:row-start-2">
          <span className="ml-4 flex shrink-0 items-center gap-1.5 rounded-dash-pill border border-dash-gold/30 bg-dash-gold/10 px-2 py-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-dash-gold">Alerts</span>
            <span className="font-dash-mono text-[11px] font-semibold text-dash-gold">
              {tickerAlerts.length}
            </span>
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
          <Link
            href="/dashboard/alerts"
            className="mr-4 shrink-0 text-[11px] font-semibold text-dash-gold hover:underline"
          >
            View All Alerts
          </Link>
        </footer>
      </div>

      <SignalSwapSheet open={sheetOpen} onClose={() => setSheetOpen(false)} signal={swapSignal} />
    </div>
  )
}
