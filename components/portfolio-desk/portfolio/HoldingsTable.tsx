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
    <section className="pd-panel is-dense">
      <div className="pd-panel-head">
        <h2 className="pd-section-label">Portfolio</h2>
        <span className="pd-section-label" style={{ letterSpacing: '0.08em' }}>
          Live · Helius + Jupiter
        </span>
      </div>

      {!connected ? (
        <div className="pd-empty">
          <h3>Connect a wallet</h3>
          <p>Holdings load from Helius + Jupiter once your wallet is connected.</p>
        </div>
      ) : loading && !holdings.length ? (
        <div style={{ padding: '8px 0' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="pd-skeleton"
              style={{ height: 32, marginBottom: 8, width: '100%' }}
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
          <table className="pd-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Asset</th>
                <th className="num">Price</th>
                <th className="num">Holdings</th>
                <th className="num">Value</th>
                <th className="num">24H</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const up = (h.change24hPct ?? 0) >= 0
                return (
                  <tr key={h.mint} tabIndex={0}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {h.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={h.logoUrl}
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
                            onError={(e) => {
                              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                              const sib = e.currentTarget.nextElementSibling as HTMLElement | null
                              if (sib) sib.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            width: 24,
                            height: 24,
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
                    <td className="num pd-num">{formatUsd(h.priceUsd, h.priceUsd < 1)}</td>
                    <td className="num pd-num">{formatAmount(h.amount, h.decimals)}</td>
                    <td className="num pd-num">{formatUsd(h.valueUsd)}</td>
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
