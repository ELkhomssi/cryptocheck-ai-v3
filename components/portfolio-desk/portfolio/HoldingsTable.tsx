'use client'

import type { Holding } from '@/types/portfolio-desk'
import { formatAmount, formatPct, formatUsd } from '@/lib/portfolio-desk/format'

export function HoldingsTable({
  holdings,
  loading,
  connected,
}: {
  holdings: Holding[]
  loading: boolean
  connected: boolean
}) {
  return (
    <section className="pd-panel">
      <div className="pd-panel-head">
        <h2>Holdings</h2>
        <span style={{ fontSize: 12, color: 'var(--pd-accent)', fontWeight: 600 }}>
          Live · Jupiter + Helius
        </span>
      </div>

      {!connected ? (
        <div className="pd-empty">
          <h3>Connect a wallet</h3>
          <p>Holdings load from Helius + Jupiter once your wallet is connected.</p>
        </div>
      ) : loading && !holdings.length ? (
        <div style={{ padding: 18 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="pd-skeleton"
              style={{ height: 36, marginBottom: 10, width: '100%' }}
            />
          ))}
        </div>
      ) : holdings.length === 0 ? (
        <div className="pd-empty">
          <h3>No holdings above dust</h3>
          <p>We hide positions under $0.50 so the book stays readable.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="pd-table" style={{ minWidth: 960 }}>
            <thead>
              <tr>
                <th>Token</th>
                <th className="num">Amount</th>
                <th className="num">Value</th>
                <th className="num">24H P&L</th>
                <th className="num">P&L %</th>
                <th className="num">Avg. Price</th>
                <th className="num">Current Price</th>
                <th className="num">Allocation</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const up = (h.change24hPct ?? 0) >= 0
                const pnlUsd =
                  h.change24hPct != null ? (h.valueUsd * h.change24hPct) / (100 + h.change24hPct) : null
                return (
                  <tr key={h.mint} tabIndex={0}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {h.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={h.logoUrl}
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
                            display: h.logoUrl ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: 'var(--font-ibm-plex-mono), monospace',
                          }}
                        >
                          {h.symbol.slice(0, 1)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{h.symbol}</div>
                          <div style={{ fontSize: 11, color: 'var(--pd-text-faint)' }}>{h.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num pd-num">{formatAmount(h.amount, h.decimals)}</td>
                    <td className="num pd-num">{formatUsd(h.valueUsd)}</td>
                    <td
                      className="num pd-num"
                      style={{
                        color:
                          pnlUsd == null
                            ? 'var(--pd-text-faint)'
                            : up
                              ? 'var(--pd-positive)'
                              : 'var(--pd-negative)',
                      }}
                    >
                      {pnlUsd != null
                        ? `${pnlUsd >= 0 ? '+' : ''}${formatUsd(Math.abs(pnlUsd))}`
                        : '—'}
                    </td>
                    <td
                      className="num pd-num"
                      style={{
                        color:
                          h.change24hPct == null
                            ? 'var(--pd-text-faint)'
                            : up
                              ? 'var(--pd-positive)'
                              : 'var(--pd-negative)',
                      }}
                    >
                      {formatPct(h.change24hPct)}
                    </td>
                    <td className="num pd-num" style={{ color: 'var(--pd-text-dim)' }}>
                      —
                    </td>
                    <td className="num pd-num">{formatUsd(h.priceUsd, h.priceUsd < 1)}</td>
                    <td className="num">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <span className="pd-num" style={{ color: 'var(--pd-text-dim)' }}>
                          {h.allocationPct.toFixed(1)}%
                        </span>
                        <div
                          style={{
                            width: 56,
                            height: 4,
                            background: 'var(--pd-surface-2)',
                            borderRadius: 2,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, Math.max(2, h.allocationPct))}%`,
                              background: 'var(--pd-accent)',
                            }}
                          />
                        </div>
                      </div>
                    </td>
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
