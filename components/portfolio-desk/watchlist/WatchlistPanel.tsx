'use client'

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { ScreenerRow } from '@/lib/providers/types'
import { formatPct, formatUsd } from '@/lib/portfolio-desk/format'

type WatchItem = {
  id: string
  mint: string
  symbol: string | null
  name: string | null
  last_risk_score: number | null
  last_verdict: string | null
  last_scanned_at: string | null
  created_at: string
  is_favorite?: boolean | null
  sort_order?: number | null
}

type WatchlistResponse = {
  items: WatchItem[]
  tier: string
  usage: { used: number; limit: number | null }
  error?: string
}

type TokenResponse = {
  token?: ScreenerRow
  available?: boolean
  error?: string
}

function riskColor(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'var(--pd-text-faint)'
  if (n >= 70) return 'var(--pd-negative)'
  if (n >= 40) return 'var(--pd-accent-bright)'
  return 'var(--pd-positive)'
}

function shortMint(m: string): string {
  if (m.length < 10) return m
  return `${m.slice(0, 4)}…${m.slice(-4)}`
}

async function fetchWatchlist(): Promise<WatchlistResponse> {
  const res = await fetch('/api/v1/watchlist', { cache: 'no-store' })
  const json = (await res.json().catch(() => ({}))) as WatchlistResponse
  if (res.status === 401) {
    const err = new Error('AUTH_REQUIRED') as Error & { status: number }
    err.status = 401
    throw err
  }
  if (!res.ok) throw new Error(json.error || 'Failed to load watchlist')
  return json
}

async function fetchTokenMetrics(mint: string): Promise<ScreenerRow | null> {
  const res = await fetch(`/api/market/token?mint=${encodeURIComponent(mint)}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    // Fallback: screener search exact-mint path
    const s = await fetch(`/api/market/screener/search?q=${encodeURIComponent(mint)}`, {
      cache: 'no-store',
    })
    if (!s.ok) return null
    const body = (await s.json()) as { hits?: ScreenerRow[] }
    return body.hits?.[0] ?? null
  }
  const body = (await res.json()) as TokenResponse
  return body.token ?? null
}

function WatchCard({
  item,
  metrics,
  metricsLoading,
  onRemove,
  onFavorite,
  busy,
}: {
  item: WatchItem
  metrics: ScreenerRow | null | undefined
  metricsLoading: boolean
  onRemove: () => void
  onFavorite: () => void
  busy: boolean
}) {
  const symbol = metrics?.symbol || item.symbol || shortMint(item.mint)
  const name = metrics?.name || item.name || 'Token'
  const price = metrics?.priceUsd
  const vol = metrics?.volume24hUsd
  const liq = metrics?.liquidityUsd
  const risk = metrics?.riskScore ?? item.last_risk_score
  const ai = metrics?.aiScore
  const chg = metrics?.change24hPct
  const fav = Boolean(item.is_favorite)

  return (
    <article
      className="pd-panel"
      style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        borderColor: fav ? 'var(--pd-accent-soft-2)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {metrics?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={metrics.logoUrl}
                alt=""
                width={28}
                height={28}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  background: 'var(--pd-surface-2)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--pd-accent-soft)',
                  color: 'var(--pd-accent-bright)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'var(--font-ibm-plex-mono), monospace',
                }}
              >
                {symbol.slice(0, 1)}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{symbol}</div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--pd-text-faint)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {name} · {shortMint(item.mint)}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="pd-icon-btn"
            aria-label={fav ? 'Unfavorite' : 'Favorite'}
            disabled={busy}
            onClick={onFavorite}
            style={{ color: fav ? 'var(--pd-accent)' : 'var(--pd-text-faint)' }}
          >
            <Star className="h-3.5 w-3.5" fill={fav ? 'currentColor' : 'none'} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="pd-icon-btn"
            aria-label="Remove"
            disabled={busy}
            onClick={onRemove}
            style={{ color: 'var(--pd-text-faint)' }}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {metricsLoading && !metrics ? (
        <div className="pd-skeleton" style={{ height: 48 }} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
            fontSize: 12,
          }}
        >
          <div>
            <div style={{ color: 'var(--pd-text-faint)', fontSize: 10, marginBottom: 2 }}>Price</div>
            <div className="pd-num" style={{ fontWeight: 600 }}>
              {price != null ? formatUsd(price, price < 1) : '—'}
            </div>
            <div
              className="pd-num"
              style={{
                fontSize: 11,
                color:
                  chg == null
                    ? 'var(--pd-text-faint)'
                    : chg >= 0
                      ? 'var(--pd-positive)'
                      : 'var(--pd-negative)',
              }}
            >
              {formatPct(chg)}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--pd-text-faint)', fontSize: 10, marginBottom: 2 }}>Volume</div>
            <div className="pd-num">{vol != null ? formatUsd(vol) : '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--pd-text-faint)' }}>
              Liq {liq != null ? formatUsd(liq) : '—'}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--pd-text-faint)', fontSize: 10, marginBottom: 2 }}>Risk / AI</div>
            <div className="pd-num" style={{ fontWeight: 600, color: riskColor(risk) }}>
              {risk ?? '—'}
              <span style={{ color: 'var(--pd-text-faint)', fontWeight: 500 }}> / </span>
              <span style={{ color: 'var(--pd-text)' }}>{ai ?? '—'}</span>
            </div>
            {item.last_verdict ? (
              <div style={{ fontSize: 11, color: 'var(--pd-text-faint)' }}>{item.last_verdict}</div>
            ) : null}
          </div>
        </div>
      )}
    </article>
  )
}

export function WatchlistPanel() {
  const qc = useQueryClient()
  const [mint, setMint] = useState('')
  const [symbol, setSymbol] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const listQ = useQuery({
    queryKey: ['terminal-watchlist'],
    queryFn: fetchWatchlist,
    retry: (count, err) => {
      if (err instanceof Error && err.message === 'AUTH_REQUIRED') return false
      return count < 2
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const items = listQ.data?.items ?? []
  const unauthorized =
    listQ.isError && listQ.error instanceof Error && listQ.error.message === 'AUTH_REQUIRED'

  const metricQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: ['watchlist-token', item.mint] as const,
      queryFn: () => fetchTokenMetrics(item.mint),
      enabled: !unauthorized && Boolean(item.mint),
      staleTime: 8_000,
      refetchInterval: 10_000,
    })),
  })

  const addMut = useMutation({
    mutationFn: async (payload: { mint: string; symbol?: string }) => {
      const res = await fetch('/api/v1/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        item?: WatchItem
        usage?: WatchlistResponse['usage']
        tier?: string
      }
      if (res.status === 401) throw new Error('AUTH_REQUIRED')
      if (!res.ok) throw new Error(json.error || 'Failed to add token')
      return json
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ['terminal-watchlist'] })
      const prev = qc.getQueryData<WatchlistResponse>(['terminal-watchlist'])
      if (prev) {
        const optimistic: WatchItem = {
          id: `optimistic-${payload.mint}`,
          mint: payload.mint,
          symbol: payload.symbol ?? null,
          name: null,
          last_risk_score: null,
          last_verdict: null,
          last_scanned_at: null,
          created_at: new Date().toISOString(),
          is_favorite: false,
          sort_order: 0,
        }
        qc.setQueryData<WatchlistResponse>(['terminal-watchlist'], {
          ...prev,
          items: [optimistic, ...prev.items.filter((i) => i.mint !== payload.mint)],
          usage: {
            ...prev.usage,
            used: prev.usage.used + 1,
          },
        })
      }
      return { prev }
    },
    onError: (err, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(['terminal-watchlist'], ctx.prev)
      setFormError(err instanceof Error ? err.message : 'Failed to add')
    },
    onSuccess: () => {
      setMint('')
      setSymbol('')
      setFormError(null)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['terminal-watchlist'] })
    },
  })

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/watchlist/${id}`, { method: 'DELETE' })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (res.status === 401) throw new Error('AUTH_REQUIRED')
      if (!res.ok) throw new Error(json.error || 'Failed to remove')
      return id
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['terminal-watchlist'] })
      const prev = qc.getQueryData<WatchlistResponse>(['terminal-watchlist'])
      if (prev) {
        qc.setQueryData<WatchlistResponse>(['terminal-watchlist'], {
          ...prev,
          items: prev.items.filter((i) => i.id !== id),
          usage: { ...prev.usage, used: Math.max(0, prev.usage.used - 1) },
        })
      }
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['terminal-watchlist'], ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['terminal-watchlist'] })
    },
  })

  const favMut = useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const res = await fetch(`/api/v1/watchlist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string; item?: WatchItem }
      if (res.status === 401) throw new Error('AUTH_REQUIRED')
      if (!res.ok) throw new Error(json.error || 'Failed to update favorite')
      return json.item
    },
    onMutate: async ({ id, is_favorite }) => {
      await qc.cancelQueries({ queryKey: ['terminal-watchlist'] })
      const prev = qc.getQueryData<WatchlistResponse>(['terminal-watchlist'])
      if (prev) {
        qc.setQueryData<WatchlistResponse>(['terminal-watchlist'], {
          ...prev,
          items: prev.items
            .map((i) => (i.id === id ? { ...i, is_favorite } : i))
            .sort((a, b) => Number(Boolean(b.is_favorite)) - Number(Boolean(a.is_favorite))),
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['terminal-watchlist'], ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['terminal-watchlist'] })
    },
  })

  const usage = listQ.data?.usage
  const usageText =
    usage == null
      ? ''
      : usage.limit == null
        ? `${usage.used} watched`
        : `${usage.used} of ${usage.limit} used`

  if (unauthorized) {
    return (
      <section className="pd-panel pd-empty">
        <h3>Sign in to sync watchlist</h3>
        <p>
          Your personal watchlist is stored on your CryptoCheck account. Sign in to add tokens and
          sync favorites across devices. No sample tokens are shown.
        </p>
        <a href="/app" className="pd-connect" style={{ display: 'inline-flex', alignItems: 'center' }}>
          Sign in
        </a>
      </section>
    )
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="pd-panel" style={{ padding: 16 }}>
        <div className="pd-panel-head" style={{ padding: 0, border: 'none', marginBottom: 12 }}>
          <h2>Watchlist</h2>
          <span style={{ fontSize: 12, color: 'var(--pd-accent)', fontWeight: 600 }}>
            {usageText || 'Live · Birdeye'}
          </span>
        </div>

        <form
          style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault()
            const m = mint.trim()
            if (!m) {
              setFormError('Enter a mint address')
              return
            }
            setFormError(null)
            addMut.mutate({ mint: m, symbol: symbol.trim() || undefined })
          }}
        >
          <div className="pd-search" style={{ maxWidth: 'none' }}>
            <input
              value={mint}
              onChange={(e) => setMint(e.target.value)}
              placeholder="Token mint address"
              aria-label="Token mint"
              disabled={addMut.isPending}
            />
          </div>
          <div className="pd-search" style={{ maxWidth: 'none' }}>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="Symbol"
              aria-label="Symbol optional"
              disabled={addMut.isPending}
            />
          </div>
          <button type="submit" className="pd-connect" disabled={addMut.isPending}>
            {addMut.isPending ? 'Adding…' : 'Add'}
          </button>
        </form>

        {formError || (listQ.isError && !unauthorized) ? (
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--pd-negative)' }}>
            {formError || (listQ.error as Error)?.message || 'Failed to load watchlist'}
            {listQ.isError ? (
              <button
                type="button"
                className="pd-connect"
                style={{ marginLeft: 8 }}
                onClick={() => void listQ.refetch()}
              >
                Retry
              </button>
            ) : null}
          </p>
        ) : null}

        {usage && usage.limit != null && usage.used >= usage.limit ? (
          <p
            style={{
              marginTop: 10,
              fontSize: 12,
              color: 'var(--pd-accent-bright)',
              background: 'var(--pd-accent-soft)',
              padding: '8px 10px',
              borderRadius: 'var(--pd-radius)',
            }}
          >
            Watchlist limit reached ({usageText}).{' '}
            <a href="/app" style={{ color: 'inherit', textDecoration: 'underline' }}>
              Upgrade
            </a>
          </p>
        ) : null}
      </div>

      {listQ.isLoading ? (
        <div className="pd-panel" style={{ padding: 18 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="pd-skeleton" style={{ height: 72, marginBottom: 10 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="pd-panel pd-empty">
          <h3>No watched tokens</h3>
          <p>Paste a Solana mint above to track live price, liquidity, risk, and AI score.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {items.map((item, idx) => {
            const mq = metricQueries[idx]
            const isOptimistic = item.id.startsWith('optimistic-')
            return (
              <WatchCard
                key={item.id}
                item={item}
                metrics={mq?.data}
                metricsLoading={Boolean(mq?.isLoading)}
                busy={removeMut.isPending || favMut.isPending || isOptimistic}
                onRemove={() => {
                  if (!isOptimistic) removeMut.mutate(item.id)
                }}
                onFavorite={() => {
                  if (!isOptimistic) {
                    favMut.mutate({ id: item.id, is_favorite: !item.is_favorite })
                  }
                }}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
