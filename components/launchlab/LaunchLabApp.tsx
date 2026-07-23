'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Copy,
  ExternalLink,
  Filter,
  Flame,
  Globe,
  GraduationCap,
  Search,
  Star,
  X,
} from 'lucide-react'
import type { LaunchRecord } from '@/lib/launch/types'
import { LAUNCH_COMPLIANCE } from '@/lib/launch/constants'
import { isLaunchModeEnabled } from '@/lib/launch/feature-flag'
import { LaunchPanel } from '@/components/dash-home/LaunchPanel'
import { RevenueWalletPill } from '@/components/revenue-dashboard/RevenueWalletPill'
import { formatAge } from '@/lib/signals-dashboard/format'

type SortKey = 'hot' | 'new' | 'safe'

const LAUNCH_ENABLED = isLaunchModeEnabled()

function heatFromLaunch(l: LaunchRecord): number {
  // Honest proxy: newer + higher safety → higher "heat". Not bonding fill (we don't track raised SOL yet).
  const ageH = Math.max(0, (Date.now() - Date.parse(l.createdAt)) / 3_600_000)
  const ageScore = Math.max(0, 100 - ageH * 4)
  const safety = typeof l.safetyScore === 'number' ? l.safetyScore : 40
  return Math.round(Math.min(100, ageScore * 0.55 + safety * 0.45))
}

function truncateMint(m: string): string {
  if (m.length < 10) return m
  return `${m.slice(0, 4)}…${m.slice(-4)}`
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text)
}

export function LaunchLabApp() {
  const [launches, setLaunches] = useState<LaunchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('hot')
  const [watchOnly, setWatchOnly] = useState(false)
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [launchOpen, setLaunchOpen] = useState(false)
  const [selected, setSelected] = useState<LaunchRecord | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/launch/list?limit=100', { cache: 'no-store' })
      const j = (await res.json()) as { launches?: LaunchRecord[]; error?: string }
      if (!res.ok) throw new Error(j.error || 'Failed to load launches')
      setLaunches(Array.isArray(j.launches) ? j.launches : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
      setLaunches([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    const id = window.setInterval(() => void reload(), 45_000)
    return () => window.clearInterval(id)
  }, [reload])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ccai:launchlab:watch')
      if (raw) setWatched(new Set(JSON.parse(raw) as string[]))
    } catch {
      /* ignore */
    }
  }, [])

  const toggleWatch = (mint: string) => {
    setWatched((prev) => {
      const next = new Set(prev)
      if (next.has(mint)) next.delete(mint)
      else next.add(mint)
      try {
        localStorage.setItem('ccai:launchlab:watch', JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const filtered = useMemo(() => {
    let rows = [...launches]
    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.ticker.toLowerCase().includes(q) ||
          l.mint.toLowerCase().includes(q),
      )
    }
    if (watchOnly) rows = rows.filter((l) => watched.has(l.mint))
    if (sort === 'new') {
      rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    } else if (sort === 'safe') {
      rows.sort((a, b) => (b.safetyScore ?? 0) - (a.safetyScore ?? 0))
    } else {
      rows.sort((a, b) => heatFromLaunch(b) - heatFromLaunch(a))
    }
    return rows
  }, [launches, query, sort, watchOnly, watched])

  const featured = useMemo(() => {
    const safe = launches.filter((l) => (l.badge || l.verdict) === 'SAFE')
    const pool = safe.length > 0 ? safe : launches
    return pool.slice().sort((a, b) => (b.safetyScore ?? 0) - (a.safetyScore ?? 0))[0] ?? null
  }, [launches])

  const newest = launches.slice(0, 8)

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] px-3 pb-16 pt-3 md:px-5 md:pt-4">
      {/* Top nav */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <Link href="/" className="font-semibold tracking-tight text-white">
            CryptoCheck
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-[13px] text-zinc-500">
            <Link href="/dashboard/launchpad/swap" className="hover:text-zinc-200">
              Swap
            </Link>
            <Link href="/dashboard" className="hover:text-zinc-200">
              Portfolio
            </Link>
            <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 font-medium text-cyan-300">
              LaunchLab
            </span>
            <Link href="/dashboard/launchpad/sniper" className="hover:text-zinc-200">
              Sniper
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 sm:inline"
          >
            Workspace
          </Link>
          <RevenueWalletPill />
        </div>
      </header>

      {/* Top tiles */}
      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <FeedCard title="Recent launches" subtitle="On CryptoCheck platform">
          {newest.length === 0 ? (
            <EmptyMini text={loading ? 'Loading…' : 'No launches yet — be first.'} />
          ) : (
            <ul className="space-y-2">
              {newest.slice(0, 5).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 text-[12px]">
                  <button
                    type="button"
                    onClick={() => setSelected(l)}
                    className="min-w-0 truncate text-left text-zinc-300 hover:text-white"
                  >
                    <span className="font-medium text-zinc-100">{l.ticker || '—'}</span>{' '}
                    <span className="text-zinc-500">{l.name}</span>
                  </button>
                  <span className="shrink-0 font-mono tabular-nums text-zinc-500">
                    {formatAge(l.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </FeedCard>

        <FeaturedTile launch={featured} heat={featured ? heatFromLaunch(featured) : 0} onOpen={setSelected} />

        <FeedCard title="New creations" subtitle="Newest first">
          {newest.length === 0 ? (
            <EmptyMini text={loading ? 'Loading…' : 'Waiting for creations…'} />
          ) : (
            <ul className="space-y-2">
              {newest.slice(0, 5).map((l) => (
                <li key={`n-${l.id}`} className="flex items-center gap-2 text-[12px]">
                  <TokenThumb url={l.imageUrl} ticker={l.ticker} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-100">
                      {l.name} <span className="text-zinc-500">[{l.ticker}]</span>
                    </p>
                    <p className="font-mono text-[11px] tabular-nums text-zinc-500">
                      {formatAge(l.createdAt)}
                    </p>
                  </div>
                  <Badge verdict={l.badge || l.verdict} />
                </li>
              ))}
            </ul>
          )}
        </FeedCard>
      </div>

      {/* Control bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(
            [
              { id: 'hot' as const, label: 'Hot', icon: Flame },
              { id: 'new' as const, label: 'New', icon: null },
              { id: 'safe' as const, label: 'Safe', icon: null },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSort(s.id)}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                sort === s.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {s.icon ? <s.icon className="h-3.5 w-3.5 text-orange-400" /> : null}
              {s.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search all"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>

        <button
          type="button"
          className="rounded-xl border border-white/10 p-2 text-zinc-500 hover:text-zinc-200"
          aria-label="Filters"
          title="Filters"
        >
          <Filter className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setWatchOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs ${
            watchOnly
              ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
              : 'border-white/10 text-zinc-500 hover:text-zinc-200'
          }`}
        >
          <Star className="h-3.5 w-3.5" />
          Watch list
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-500">
          <GraduationCap className="h-3.5 w-3.5" />
          Graduated
          <span className="text-[10px] text-zinc-600">soon</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-500">
          <Globe className="h-3.5 w-3.5" />
          Platforms
        </span>
        <span className="rounded-xl border border-white/10 px-3 py-2 font-mono text-xs tabular-nums text-zinc-400">
          SOL
        </span>
        <button
          type="button"
          disabled={!LAUNCH_ENABLED}
          title={LAUNCH_ENABLED ? undefined : 'Token create coming soon — Stage 1 beta'}
          onClick={() => {
            if (!LAUNCH_ENABLED) return
            setLaunchOpen(true)
          }}
          className={`ml-auto rounded-xl px-5 py-2.5 text-sm font-semibold ${
            LAUNCH_ENABLED
              ? 'bg-cyan-400 text-zinc-950 shadow-[0_0_24px_rgba(34,211,238,0.25)] hover:bg-cyan-300'
              : 'cursor-not-allowed border border-white/10 bg-white/5 text-zinc-500'
          }`}
        >
          {LAUNCH_ENABLED ? 'Launch token' : 'Launch · Coming soon'}
        </button>
      </div>

      {error ? (
        <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}

      {/* Grid */}
      {loading && launches.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-sm text-zinc-400">No tokens match.</p>
          {LAUNCH_ENABLED ? (
            <button
              type="button"
              onClick={() => setLaunchOpen(true)}
              className="mt-4 text-sm font-medium text-cyan-300 hover:underline"
            >
              Launch the first one
            </button>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">Launch token · coming soon</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((l) => (
            <TokenCard
              key={l.id}
              launch={l}
              heat={heatFromLaunch(l)}
              watched={watched.has(l.mint)}
              onWatch={() => toggleWatch(l.mint)}
              onOpen={() => setSelected(l)}
            />
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-[10px] leading-relaxed text-zinc-600">{LAUNCH_COMPLIANCE}</p>
      <p className="mt-1 text-center text-[10px] text-zinc-700">
        Heat is a recency×safety score — not live bonding fill. Buys feed when on-chain activity is wired.
      </p>

      {/* Launch modal — same prepare/confirm code as Action Panel (gated for Stage 1) */}
      {LAUNCH_ENABLED && launchOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
          <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0c0e14] p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setLaunchOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <LaunchPanel
              onLaunched={() => {
                void reload()
                setLaunchOpen(false)
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Detail sheet */}
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0c0e14] p-5 shadow-2xl">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <TokenThumb url={selected.imageUrl} ticker={selected.ticker} large />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white">{selected.name}</h2>
                <p className="font-mono text-sm text-zinc-500">{selected.ticker}</p>
                <Badge verdict={selected.badge || selected.verdict} />
              </div>
            </div>
            {selected.description ? (
              <p className="mt-3 text-sm text-zinc-400">{selected.description}</p>
            ) : null}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[10px] uppercase text-zinc-600">Mint</dt>
                <dd className="font-mono text-xs text-zinc-200">{truncateMint(selected.mint)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-zinc-600">SOL target</dt>
                <dd className="font-mono tabular-nums text-zinc-200">{selected.solTarget}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-zinc-600">Safety</dt>
                <dd className="font-mono tabular-nums text-zinc-200">
                  {selected.safetyScore ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase text-zinc-600">Created</dt>
                <dd className="font-mono tabular-nums text-zinc-200">{formatAge(selected.createdAt)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyText(selected.mint)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
              >
                <Copy className="h-3.5 w-3.5" /> Copy mint
              </button>
              <a
                href={`https://solscan.io/token/${selected.mint}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Solscan
              </a>
              <Link
                href={`/dashboard/launchpad/swap?mint=${encodeURIComponent(selected.mint)}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/90 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-cyan-300"
              >
                Risk Swap
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function FeedCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{title}</p>
      <p className="mb-3 text-[11px] text-zinc-600">{subtitle}</p>
      {children}
    </section>
  )
}

function FeaturedTile({
  launch,
  heat,
  onOpen,
}: {
  launch: LaunchRecord | null
  heat: number
  onOpen: (l: LaunchRecord) => void
}) {
  if (!launch) {
    return (
      <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-violet-950/40 to-transparent p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Featured</p>
        <p className="mt-6 text-sm text-zinc-500">No featured token yet.</p>
      </section>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(launch)}
      className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/50 via-[#0c0e14] to-transparent p-4 text-left transition hover:border-violet-400/35"
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-violet-300/70">Featured</p>
      <div className="mt-3 flex items-center gap-3">
        <TokenThumb url={launch.imageUrl} ticker={launch.ticker} large />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-white">{launch.name}</p>
          <p className="truncate text-xs text-zinc-400">{launch.description || launch.ticker}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="font-mono tabular-nums text-emerald-300">
          Target {launch.solTarget} SOL
        </span>
        <Badge verdict={launch.badge || launch.verdict} />
      </div>
      <HeatBar value={heat} />
    </button>
  )
}

function TokenCard({
  launch,
  heat,
  watched,
  onWatch,
  onOpen,
}: {
  launch: LaunchRecord
  heat: number
  watched: boolean
  onWatch: () => void
  onOpen: () => void
}) {
  return (
    <article className="group relative flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 transition hover:border-white/15">
      <div className="mb-2 flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <p className="truncate font-semibold text-zinc-50">
            {launch.ticker || 'TOKEN'}{' '}
            <span className="font-normal text-zinc-500">{launch.name}</span>
          </p>
          <p className="font-mono text-[11px] tabular-nums text-zinc-600">
            {formatAge(launch.createdAt)}
          </p>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onWatch}
            className={`rounded-md p-1.5 ${watched ? 'text-amber-300' : 'text-zinc-600 hover:text-zinc-300'}`}
            aria-label="Watch"
          >
            <Star className={`h-3.5 w-3.5 ${watched ? 'fill-amber-300' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => copyText(launch.mint)}
            className="rounded-md p-1.5 text-zinc-600 hover:text-zinc-300"
            aria-label="Copy mint"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <a
            href={`https://solscan.io/token/${launch.mint}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md p-1.5 text-zinc-600 hover:text-zinc-300"
            aria-label="Open Solscan"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <button type="button" onClick={onOpen} className="flex flex-1 gap-3 text-left">
        <TokenThumb url={launch.imageUrl} ticker={launch.ticker} large />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[12px] leading-snug text-zinc-400">
            {launch.description || `${launch.name} · CryptoCheck LaunchLab`}
          </p>
          <p className="mt-2 font-mono text-sm tabular-nums text-emerald-300">
            Target {launch.solTarget} SOL
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Badge verdict={launch.badge || launch.verdict} />
            {typeof launch.safetyScore === 'number' ? (
              <span className="font-mono text-[10px] tabular-nums text-zinc-500">
                safety {launch.safetyScore}
              </span>
            ) : null}
          </div>
        </div>
      </button>
      <HeatBar value={heat} />
    </article>
  )
}

function TokenThumb({
  url,
  ticker,
  large,
}: {
  url: string | null
  ticker: string
  large?: boolean
}) {
  const size = large ? 'h-14 w-14' : 'h-8 w-8'
  if (url && (url.startsWith('http') || url.startsWith('data:'))) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={`${size} shrink-0 rounded-xl object-cover bg-zinc-800`} />
    )
  }
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 text-[10px] font-bold text-zinc-300`}
    >
      {(ticker || '?').slice(0, 3)}
    </div>
  )
}

function HeatBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="mt-3 flex items-center gap-2">
      <Flame className="h-3.5 w-3.5 shrink-0 text-orange-400" />
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-300"
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-zinc-500">{v}</span>
    </div>
  )
}

function Badge({ verdict }: { verdict: string | null | undefined }) {
  if (!verdict) return <span className="text-[10px] uppercase text-zinc-600">scanning</span>
  const v = String(verdict).toUpperCase()
  const cls =
    v === 'SAFE'
      ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
      : v === 'CAUTION' || v === 'HIGH_RISK'
        ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
        : 'text-red-300 border-red-500/30 bg-red-500/10'
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
      {v}
    </span>
  )
}

function EmptyMini({ text }: { text: string }) {
  return <p className="py-4 text-center text-xs text-zinc-600">{text}</p>
}
