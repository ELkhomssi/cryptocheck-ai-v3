'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeftRight, Star, X } from 'lucide-react'
import type { ScreenerRow } from '@/lib/providers/types'
import type { OhlcvPoint } from '@/lib/providers/types'
import { formatPct, formatUsd } from '@/lib/portfolio-desk/format'

type TokenResponse = {
  token?: ScreenerRow
  available?: boolean
  source?: string
  error?: string
}

type OhlcvResponse = {
  candles?: OhlcvPoint[]
  available?: boolean
}

function compactUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return formatUsd(n, n < 1)
}

export function TokenInspectPanel({
  mint,
  onClose,
  onTrade,
  onWatch,
}: {
  mint: string
  onClose: () => void
  onTrade: (mint: string) => void
  onWatch: (mint: string, symbol?: string) => void
}) {
  const tokenQ = useQuery({
    queryKey: ['token-inspect', mint],
    queryFn: async () => {
      const res = await fetch(`/api/market/token?mint=${encodeURIComponent(mint)}`, {
        cache: 'no-store',
      })
      const body = (await res.json().catch(() => ({}))) as TokenResponse
      if (!res.ok && !body.token) throw new Error(body.error || 'Token unavailable')
      return body
    },
    enabled: mint.length >= 32,
    staleTime: 10_000,
    refetchInterval: 20_000,
  })

  const chartQ = useQuery({
    queryKey: ['token-ohlcv', mint],
    queryFn: async () => {
      const res = await fetch(
        `/api/market/ohlcv?mint=${encodeURIComponent(mint)}&type=15m&hours=48`,
        { cache: 'no-store' },
      )
      const body = (await res.json().catch(() => ({}))) as OhlcvResponse
      return body
    },
    enabled: mint.length >= 32,
    staleTime: 30_000,
  })

  const token = tokenQ.data?.token
  const series = (chartQ.data?.candles ?? []).map((c) => ({
    t: c.t * 1000,
    price: c.c,
  }))

  return (
    <section className="pd-panel" style={{ padding: 16, marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="pd-eyebrow">TOKEN</div>
          <h2 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            {token?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={token.logoUrl}
                alt=""
                width={28}
                height={28}
                style={{ borderRadius: 999 }}
              />
            ) : null}
            <span>
              {token?.symbol || '…'}{' '}
              <span style={{ color: 'var(--pd-text-dim)', fontWeight: 500, fontSize: 14 }}>
                {token?.name || ''}
              </span>
            </span>
          </h2>
          <div className="pd-num" style={{ fontSize: 11, color: 'var(--pd-text-faint)', marginTop: 4 }}>
            {mint}
          </div>
        </div>
        <button type="button" className="pd-icon-btn" aria-label="Close token" onClick={onClose}>
          <X className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>

      {tokenQ.isError ? (
        <p style={{ color: 'var(--pd-negative)', fontSize: 13 }}>
          {(tokenQ.error as Error).message || 'Failed to load token'}
        </p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        {[
          {
            label: 'Price',
            value: token ? formatUsd(token.priceUsd, token.priceUsd < 1) : '—',
          },
          {
            label: '24h',
            value: token ? formatPct(token.change24hPct) : '—',
            color: token && token.change24hPct !== 0
              ? token.change24hPct > 0
                ? 'var(--pd-positive)'
                : 'var(--pd-negative)'
              : undefined,
          },
          { label: 'Liquidity', value: token ? compactUsd(token.liquidityUsd) : '—' },
          { label: 'Volume', value: token ? compactUsd(token.volume24hUsd) : '—' },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--pd-radius)',
              border: '1px solid var(--pd-border-soft)',
              background: 'var(--pd-surface-2)',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--pd-text-faint)', letterSpacing: '0.06em' }}>
              {m.label}
            </div>
            <div
              className="pd-num"
              style={{ fontSize: 15, fontWeight: 600, marginTop: 4, color: m.color }}
            >
              {tokenQ.isLoading ? '…' : m.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          height: 200,
          marginBottom: 14,
          borderRadius: 'var(--pd-radius)',
          border: '1px solid var(--pd-border-soft)',
          background: 'var(--pd-surface-2)',
          padding: '8px 4px 0',
        }}
      >
        {chartQ.isLoading ? (
          <div className="pd-skeleton" style={{ height: '100%', margin: 8 }} />
        ) : series.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="pdTokenFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--pd-accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--pd-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip
                contentStyle={{
                  background: 'var(--pd-bg-elevated)',
                  border: '1px solid var(--pd-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) => new Date(Number(v)).toLocaleString()}
                formatter={(v: number) => [formatUsd(v, v < 1), 'Price']}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke="var(--pd-accent-bright)"
                fill="url(#pdTokenFill)"
                strokeWidth={1.6}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div
            style={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              color: 'var(--pd-text-faint)',
              padding: 16,
              textAlign: 'center',
            }}
          >
            Chart unavailable (no OHLCV from Birdeye for this mint). Metrics above still use live
            providers when present.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          className="pd-connect"
          onClick={() => onTrade(mint)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <ArrowLeftRight className="h-4 w-4" strokeWidth={1.8} />
          Swap
        </button>
        <button
          type="button"
          className="pd-tab"
          onClick={() => onWatch(mint, token?.symbol)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Star className="h-4 w-4" strokeWidth={1.8} />
          Watch
        </button>
        {tokenQ.data?.source ? (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--pd-text-faint)' }}>
            source · {tokenQ.data.source}
          </span>
        ) : null}
      </div>
    </section>
  )
}
