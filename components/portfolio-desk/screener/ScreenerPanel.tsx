'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search } from 'lucide-react'
import type { ScreenerRow } from '@/lib/providers/types'
import { formatPct, formatUsd } from '@/lib/portfolio-desk/format'

type SortKey =
  | 'token'
  | 'symbol'
  | 'price'
  | 'change5m'
  | 'change1h'
  | 'change24h'
  | 'volume'
  | 'liquidity'
  | 'marketCap'
  | 'fdv'
  | 'holders'
  | 'smartMoney'
  | 'riskScore'
  | 'aiScore'

type FilterState = {
  sort: SortKey
  order: 'asc' | 'desc'
  minLiquidity: string
  maxRisk: string
  minVolume: string
  minAi: string
  pumpfun: boolean
  raydium: boolean
  graduated: boolean
  verified: boolean
  trending: boolean
  new: boolean
  q: string
}

const COLUMNS: { key: SortKey; label: string; num?: boolean; width: number }[] = [
  { key: 'token', label: 'Token', width: 180 },
  { key: 'symbol', label: 'Symbol', width: 88 },
  { key: 'price', label: 'Price', num: true, width: 100 },
  { key: 'change5m', label: '5m', num: true, width: 72 },
  { key: 'change1h', label: '1H', num: true, width: 72 },
  { key: 'change24h', label: '24H', num: true, width: 72 },
  { key: 'volume', label: 'Volume', num: true, width: 100 },
  { key: 'liquidity', label: 'Liquidity', num: true, width: 100 },
  { key: 'marketCap', label: 'Market Cap', num: true, width: 108 },
  { key: 'fdv', label: 'FDV', num: true, width: 100 },
  { key: 'holders', label: 'Holders', num: true, width: 80 },
  { key: 'smartMoney', label: 'Smart Money', num: true, width: 96 },
  { key: 'riskScore', label: 'Risk Score', num: true, width: 88 },
  { key: 'aiScore', label: 'AI Score', num: true, width: 80 },
]

const TABLE_MIN_WIDTH = COLUMNS.reduce((s, c) => s + c.width, 0)

const FLAG_CHIPS: { key: keyof Pick<FilterState, 'new' | 'verified' | 'pumpfun' | 'raydium' | 'graduated' | 'trending'>; label: string }[] = [
  { key: 'new', label: 'New Launches' },
  { key: 'verified', label: 'Verified' },
  { key: 'pumpfun', label: 'Pump.fun' },
  { key: 'raydium', label: 'Raydium' },
  { key: 'graduated', label: 'Graduated' },
  { key: 'trending', label: 'Trending' },
]

function compactUsd(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return formatUsd(n, abs < 1)
}

function pctColor(n: number): string {
  if (!Number.isFinite(n) || n === 0) return 'var(--pd-text-faint)'
  return n > 0 ? 'var(--pd-positive)' : 'var(--pd-negative)'
}

function riskColor(n: number): string {
  if (n >= 70) return 'var(--pd-negative)'
  if (n >= 40) return 'var(--pd-accent-bright)'
  return 'var(--pd-positive)'
}

function readFilters(sp: URLSearchParams): FilterState {
  const sortRaw = sp.get('sort') || 'volume'
  const sort = (COLUMNS.some((c) => c.key === sortRaw) ? sortRaw : 'volume') as SortKey
  return {
    sort,
    order: sp.get('order') === 'asc' ? 'asc' : 'desc',
    minLiquidity: sp.get('minLiquidity') || '',
    maxRisk: sp.get('maxRisk') || '',
    minVolume: sp.get('minVolume') || '',
    minAi: sp.get('minAi') || '',
    pumpfun: sp.get('pumpfun') === '1',
    raydium: sp.get('raydium') === '1',
    graduated: sp.get('graduated') === '1',
    verified: sp.get('verified') === '1',
    trending: sp.get('trending') === '1',
    new: sp.get('new') === '1',
    q: sp.get('q') || '',
  }
}

function filtersToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (f.sort !== 'volume') p.set('sort', f.sort)
  if (f.order !== 'desc') p.set('order', f.order)
  if (f.minLiquidity) p.set('minLiquidity', f.minLiquidity)
  if (f.maxRisk) p.set('maxRisk', f.maxRisk)
  if (f.minVolume) p.set('minVolume', f.minVolume)
  if (f.minAi) p.set('minAi', f.minAi)
  if (f.pumpfun) p.set('pumpfun', '1')
  if (f.raydium) p.set('raydium', '1')
  if (f.graduated) p.set('graduated', '1')
  if (f.verified) p.set('verified', '1')
  if (f.trending) p.set('trending', '1')
  if (f.new) p.set('new', '1')
  if (f.q) p.set('q', f.q)
  return p
}

function buildScreenerUrl(f: FilterState): string {
  const p = new URLSearchParams()
  p.set('sort', f.sort)
  p.set('order', f.order)
  p.set('offset', '0')
  p.set('limit', '80')
  if (f.minLiquidity) p.set('minLiquidity', f.minLiquidity)
  if (f.maxRisk) p.set('maxRisk', f.maxRisk)
  if (f.minVolume) p.set('minVolume', f.minVolume)
  if (f.minAi) p.set('minAi', f.minAi)
  if (f.pumpfun) p.set('pumpfun', '1')
  if (f.raydium) p.set('raydium', '1')
  if (f.graduated) p.set('graduated', '1')
  if (f.verified) p.set('verified', '1')
  if (f.trending) p.set('trending', '1')
  if (f.new) p.set('new', '1')
  return `/api/market/screener?${p.toString()}`
}

function sortRows(rows: ScreenerRow[], sort: SortKey, order: 'asc' | 'desc'): ScreenerRow[] {
  const dir = order === 'asc' ? 1 : -1
  const copy = [...rows]
  copy.sort((a, b) => {
    const pick = (r: ScreenerRow): number | string => {
      switch (sort) {
        case 'token':
          return (r.name || r.symbol || '').toLowerCase()
        case 'symbol':
          return (r.symbol || '').toLowerCase()
        case 'price':
          return r.priceUsd
        case 'change5m':
          return r.change5mPct
        case 'change1h':
          return r.change1hPct
        case 'change24h':
          return r.change24hPct
        case 'volume':
          return r.volume24hUsd
        case 'liquidity':
          return r.liquidityUsd
        case 'marketCap':
          return r.marketCapUsd
        case 'fdv':
          return r.fdvUsd
        case 'holders':
          return r.holders
        case 'smartMoney':
          return r.smartMoneyScore
        case 'riskScore':
          return r.riskScore
        case 'aiScore':
          return r.aiScore
        default:
          return r.volume24hUsd
      }
    }
    const av = pick(a)
    const bv = pick(b)
    if (typeof av === 'string' && typeof bv === 'string') return dir * av.localeCompare(bv)
    return dir * ((av as number) - (bv as number))
  })
  return copy
}

export function ScreenerPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<FilterState>(() => readFilters(searchParams))
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('q') || '')
  const [rows, setRows] = useState<ScreenerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const parentRef = useRef<HTMLDivElement>(null)
  const syncSkip = useRef(false)

  const replaceUrl = useCallback(
    (next: FilterState) => {
      const p = filtersToParams(next)
      const qs = p.toString()
      syncSkip.current = true
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    },
    [router],
  )

  const patchFilters = useCallback(
    (patch: Partial<FilterState>) => {
      setFilters((prev) => {
        const next = { ...prev, ...patch }
        replaceUrl(next)
        return next
      })
    },
    [replaceUrl],
  )

  // Keep local state in sync when URL changes externally (shareable links).
  useEffect(() => {
    if (syncSkip.current) {
      syncSkip.current = false
      return
    }
    const next = readFilters(searchParams)
    setFilters(next)
    setSearchDraft(next.q)
  }, [searchParams])

  // Debounced search → /api/market/screener/search
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const q = searchDraft.trim()
      if (q === filters.q) return
      patchFilters({ q })
    }, 200)
    return () => window.clearTimeout(handle)
  }, [searchDraft, filters.q, patchFilters])

  // Load rows: search mode vs filter/sort mode
  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    setError(null)

    const run = async () => {
      try {
        if (filters.q.trim()) {
          const res = await fetch(
            `/api/market/screener/search?q=${encodeURIComponent(filters.q.trim())}`,
            { cache: 'no-store', signal: ac.signal },
          )
          if (!res.ok) throw new Error(`Search failed (${res.status})`)
          const body = (await res.json()) as {
            hits?: ScreenerRow[]
            available?: boolean
          }
          if (ac.signal.aborted) return
          startTransition(() => {
            setRows(sortRows(body.hits ?? [], filters.sort, filters.order))
            setAvailable(body.available !== false)
            setLoading(false)
          })
          return
        }

        const res = await fetch(buildScreenerUrl(filters), {
          cache: 'no-store',
          signal: ac.signal,
        })
        if (!res.ok) throw new Error(`Screener failed (${res.status})`)
        const body = (await res.json()) as {
          rows?: ScreenerRow[]
          available?: boolean
        }
        if (ac.signal.aborted) return
        startTransition(() => {
          setRows(body.rows ?? [])
          setAvailable(body.available !== false)
          setLoading(false)
        })
      } catch (e) {
        if (ac.signal.aborted) return
        setError((e as Error).message || 'Failed to load screener')
        setRows([])
        setAvailable(false)
        setLoading(false)
      }
    }

    void run()
    return () => ac.abort()
  }, [filters])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 14,
  })

  const onSort = (key: SortKey) => {
    if (filters.sort === key) {
      patchFilters({ order: filters.order === 'asc' ? 'desc' : 'asc' })
    } else {
      patchFilters({ sort: key, order: key === 'riskScore' ? 'asc' : 'desc' })
    }
  }

  return (
    <section className="pd-panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="pd-panel-head" style={{ padding: '14px 18px' }}>
        <h2>Token Screener</h2>
        <span style={{ fontSize: 12, color: 'var(--pd-accent)', fontWeight: 600 }}>
          Live · Birdeye
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          padding: '0 18px 14px',
          alignItems: 'center',
        }}
      >
        <form
          className="pd-search"
          style={{ maxWidth: 280, flex: '1 1 200px' }}
          onSubmit={(e) => e.preventDefault()}
        >
          <Search className="h-[15px] w-[15px] shrink-0" strokeWidth={2} />
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search symbol, name, or mint…"
            aria-label="Search tokens"
          />
        </form>

        <label className="pd-chip" style={{ gap: 6 }}>
          Min Liquidity
          <input
            type="number"
            min={0}
            className="pd-num"
            value={filters.minLiquidity}
            onChange={(e) => patchFilters({ minLiquidity: e.target.value })}
            placeholder="0"
            style={{
              width: 72,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--pd-text)',
              fontSize: 12,
            }}
          />
        </label>

        <label className="pd-chip" style={{ gap: 6 }}>
          Max Risk
          <input
            type="number"
            min={0}
            max={100}
            className="pd-num"
            value={filters.maxRisk}
            onChange={(e) => patchFilters({ maxRisk: e.target.value })}
            placeholder="100"
            style={{
              width: 48,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--pd-text)',
              fontSize: 12,
            }}
          />
        </label>

        <label className="pd-chip" style={{ gap: 6 }}>
          Min Volume
          <input
            type="number"
            min={0}
            className="pd-num"
            value={filters.minVolume}
            onChange={(e) => patchFilters({ minVolume: e.target.value })}
            placeholder="0"
            style={{
              width: 72,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--pd-text)',
              fontSize: 12,
            }}
          />
        </label>

        <label className="pd-chip" style={{ gap: 6 }}>
          Min AI Score
          <input
            type="number"
            min={0}
            max={100}
            className="pd-num"
            value={filters.minAi}
            onChange={(e) => patchFilters({ minAi: e.target.value })}
            placeholder="0"
            style={{
              width: 48,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--pd-text)',
              fontSize: 12,
            }}
          />
        </label>
      </div>

      <div className="pd-tabs" style={{ padding: '0 18px 12px', flexWrap: 'wrap' }}>
        {FLAG_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={`pd-tab${filters[chip.key] ? ' is-active' : ''}`}
            onClick={() => patchFilters({ [chip.key]: !filters[chip.key] })}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {error ? (
        <div style={{ padding: 18, color: 'var(--pd-negative)', fontSize: 13 }}>{error}</div>
      ) : null}

      {loading && !rows.length ? (
        <div style={{ padding: 18 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="pd-skeleton"
              style={{ height: 36, marginBottom: 10, width: '100%' }}
            />
          ))}
        </div>
      ) : !rows.length ? (
        <div className="pd-empty">
          <h3>{available === false ? 'Market data unavailable' : 'No tokens match'}</h3>
          <p>
            {available === false
              ? 'Birdeye / market providers returned no rows. Fallbacks (DexScreener, Jupiter, Helius, Raydium) also empty — try again later. Nothing is fabricated.'
              : 'Adjust filters or clear search to broaden results.'}
          </p>
        </div>
      ) : (
        <div ref={parentRef} style={{ height: 'min(62vh, 640px)', overflow: 'auto' }}>
          <div style={{ minWidth: TABLE_MIN_WIDTH }}>
            <div
              role="row"
              style={{
                display: 'flex',
                position: 'sticky',
                top: 0,
                zIndex: 1,
                background: 'var(--pd-bg-elevated)',
                borderBottom: '1px solid var(--pd-border-soft)',
              }}
            >
              {COLUMNS.map((col) => (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => onSort(col.key)}
                  style={{
                    width: col.width,
                    flexShrink: 0,
                    textAlign: col.num ? 'right' : 'left',
                    fontSize: 10.5,
                    letterSpacing: '0.06em',
                    color: 'var(--pd-text-faint)',
                    fontWeight: 600,
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {col.label}
                  {filters.sort === col.key ? (filters.order === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              ))}
            </div>

            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: 'relative',
                width: '100%',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index]
                if (!row) return null
                return (
                  <div
                    key={row.mint}
                    role="row"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: 'flex',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--pd-border-soft)',
                      fontSize: 13,
                    }}
                  >
                    <div style={{ width: COLUMNS[0].width, flexShrink: 0, padding: '0 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {row.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.logoUrl}
                            alt=""
                            width={24}
                            height={24}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              background: 'var(--pd-surface-2)',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: 'var(--pd-accent-soft)',
                              color: 'var(--pd-accent-bright)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 700,
                              fontFamily: 'var(--font-ibm-plex-mono), monospace',
                            }}
                          >
                            {(row.symbol || '?').slice(0, 1)}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {row.name || row.symbol || '—'}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: 'var(--pd-text-faint)',
                              fontFamily: 'var(--font-ibm-plex-mono), monospace',
                            }}
                          >
                            {row.mint.slice(0, 4)}…{row.mint.slice(-4)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      className="pd-num"
                      style={{ width: COLUMNS[1].width, flexShrink: 0, padding: '0 12px' }}
                    >
                      {row.symbol || '—'}
                    </div>
                    <Cell num width={COLUMNS[2].width}>
                      {formatUsd(row.priceUsd, row.priceUsd < 1)}
                    </Cell>
                    <Cell num width={COLUMNS[3].width} color={pctColor(row.change5mPct)}>
                      {formatPct(row.change5mPct)}
                    </Cell>
                    <Cell num width={COLUMNS[4].width} color={pctColor(row.change1hPct)}>
                      {formatPct(row.change1hPct)}
                    </Cell>
                    <Cell num width={COLUMNS[5].width} color={pctColor(row.change24hPct)}>
                      {formatPct(row.change24hPct)}
                    </Cell>
                    <Cell num width={COLUMNS[6].width}>
                      {compactUsd(row.volume24hUsd)}
                    </Cell>
                    <Cell num width={COLUMNS[7].width}>
                      {compactUsd(row.liquidityUsd)}
                    </Cell>
                    <Cell num width={COLUMNS[8].width}>
                      {compactUsd(row.marketCapUsd)}
                    </Cell>
                    <Cell num width={COLUMNS[9].width}>
                      {compactUsd(row.fdvUsd)}
                    </Cell>
                    <Cell num width={COLUMNS[10].width}>
                      {row.holders.toLocaleString()}
                    </Cell>
                    <Cell num width={COLUMNS[11].width}>
                      {Math.round(row.smartMoneyScore)}
                    </Cell>
                    <Cell num width={COLUMNS[12].width} color={riskColor(row.riskScore)}>
                      {row.riskScore}
                    </Cell>
                    <Cell num width={COLUMNS[13].width}>
                      {row.aiScore}
                    </Cell>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Cell({
  children,
  width,
  num,
  color,
}: {
  children: ReactNode
  width: number
  num?: boolean
  color?: string
}) {
  return (
    <div
      className={num ? 'pd-num' : undefined}
      style={{
        width,
        flexShrink: 0,
        padding: '0 12px',
        textAlign: num ? 'right' : 'left',
        color: color ?? undefined,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  )
}
