'use client'

import type { ScreenerRow, TokenMarketMetrics } from '@/lib/providers/types'
import { formatPct, formatUsd } from '@/lib/portfolio-desk/format'
import { useMarketFeed, type MarketFeedKey } from '../hooks/useMarketFeed'

const SECTIONS: { key: MarketFeedKey; title: string; hint: string }[] = [
  { key: 'gainers', title: 'Gainers', hint: '24h ↑' },
  { key: 'losers', title: 'Losers', hint: '24h ↓' },
  { key: 'trending', title: 'Trending', hint: 'Birdeye rank' },
  { key: 'new-launches', title: 'New launches', hint: 'Birdeye + Raydium' },
  { key: 'graduated', title: 'Graduated', hint: 'Bonding → AMM' },
  { key: 'volume', title: 'Volume', hint: '24h USD' },
  { key: 'smart-money', title: 'Smart money', hint: 'Best-effort score' },
]

function formatCompactUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return formatUsd(n)
}

function isScreener(row: ScreenerRow | TokenMarketMetrics): row is ScreenerRow {
  return 'smartMoneyScore' in row
}

function FeedSection({ keyName, title, hint }: { keyName: MarketFeedKey; title: string; hint: string }) {
  const q = useMarketFeed(keyName)
  const items = q.data?.items ?? []
  const source = q.data?.source
  const err = q.data?.error
  const loading = q.isLoading && !items.length

  return (
    <section className="pd-panel">
      <div className="pd-panel-head">
        <h2>{title}</h2>
        <span style={{ fontSize: 12, color: 'var(--pd-accent)', fontWeight: 600 }}>
          {source === 'unavailable'
            ? 'Unavailable'
            : source
              ? `Live · ${hint}`
              : loading
                ? 'Loading…'
                : hint}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 18 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="pd-skeleton"
              style={{ height: 36, marginBottom: 10, width: '100%' }}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="pd-empty">
          <h3>{err ? 'Feed unavailable' : 'No tokens'}</h3>
          <p>
            {err ||
              (source === 'unavailable'
                ? 'Market data requires BIRDEYE_API_KEY on the server.'
                : 'Nothing returned for this window. Retry on the next refresh.')}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="pd-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Token</th>
                <th className="num">Price</th>
                <th className="num">24H</th>
                <th className="num">Volume</th>
                <th className="num">Liquidity</th>
                {keyName === 'smart-money' ? <th className="num">Smart $</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const up = (row.change24hPct ?? 0) >= 0
                const symbol = row.symbol || row.mint.slice(0, 4)
                const name = row.name || row.mint.slice(0, 8)
                const score = isScreener(row) ? row.smartMoneyScore : 0
                return (
                  <tr key={row.mint} tabIndex={0}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {row.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.logoUrl}
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
                            onError={(e) => {
                              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                              const sib = e.currentTarget.nextElementSibling as HTMLElement | null
                              if (sib) sib.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'var(--pd-accent-soft)',
                            color: 'var(--pd-accent-bright)',
                            display: row.logoUrl ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: 'var(--font-ibm-plex-mono), monospace',
                          }}
                        >
                          {symbol.slice(0, 1)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{symbol}</div>
                          <div style={{ fontSize: 11, color: 'var(--pd-text-faint)' }}>{name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num pd-num">
                      {formatUsd(row.priceUsd, row.priceUsd > 0 && row.priceUsd < 1)}
                    </td>
                    <td className="num">
                      <span className={up ? 'pd-badge-up' : 'pd-badge-down'}>
                        {formatPct(row.change24hPct)}
                      </span>
                    </td>
                    <td className="num pd-num">{formatCompactUsd(row.volume24hUsd)}</td>
                    <td className="num pd-num">{formatCompactUsd(row.liquidityUsd)}</td>
                    {keyName === 'smart-money' ? (
                      <td className="num pd-num" style={{ color: 'var(--pd-text-dim)' }}>
                        {score > 0 ? score.toFixed(0) : '—'}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function MarketFeeds() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {SECTIONS.map((s) => (
        <FeedSection key={s.key} keyName={s.key} title={s.title} hint={s.hint} />
      ))}
    </div>
  )
}
