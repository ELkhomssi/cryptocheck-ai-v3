'use client'

import { useEffect, useMemo, useState } from 'react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { loadTradeLog } from '@/lib/trading-terminal/trade-log'
import { useTerminalPortfolio } from './MiniPortfolioCard'
import { useTerminalFocus } from './TerminalFocusProvider'

function PortionsDonut({
  positions,
  total,
}: {
  positions: Array<{ mint: string; symbol: string; valueUsd: number }>
  total: number
}) {
  const slices = useMemo(() => {
    if (!positions.length || total <= 0) return []
    let cursor = 0
    const colors = [
      'var(--tit-accent)',
      'var(--tit-accent-2)',
      'var(--tit-pos)',
      'var(--tit-warn)',
      'var(--tit-hot)',
      'var(--tit-text-2)',
    ]
    return positions.slice(0, 6).map((p, i) => {
      const pct = (p.valueUsd / total) * 100
      const start = cursor
      cursor += pct
      return { ...p, pct, start, color: colors[i % colors.length]! }
    })
  }, [positions, total])

  const gradient =
    slices.length === 0
      ? 'conic-gradient(var(--tit-bg-3) 0 100%)'
      : `conic-gradient(${slices
          .map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`)
          .join(', ')})`

  return (
    <div className="tit-panel-flat flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-[var(--tit-border)] px-2 py-1">
        <p className="tit-label">Portions</p>
      </div>
      <div className="flex flex-1 items-center gap-2 p-2">
        <div
          className="relative h-14 w-14 shrink-0 rounded-full"
          style={{ background: gradient }}
          aria-hidden
        >
          <div className="absolute inset-2 flex items-center justify-center rounded-full bg-[var(--tit-bg-1)]">
            <span className="tit-mono text-[0.55rem] text-[var(--tit-text-0)]">
              {total > 0 ? `$${total.toFixed(0)}` : '—'}
            </span>
          </div>
        </div>
        <ul className="tit-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {slices.length === 0 ? (
            <li className="text-[0.65rem] text-[var(--tit-text-1)]">No holdings yet — connect wallet.</li>
          ) : (
            slices.map((s) => (
              <li key={s.mint} className="flex justify-between text-[0.6rem]">
                <span className="truncate text-[var(--tit-text-1)]">{s.symbol}</span>
                <span className="tit-mono text-[var(--tit-text-0)]">{s.pct.toFixed(0)}%</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}

function PositionsTable() {
  const { data, error, loading, isConnected, connect, selectMint, armExit } = useTerminalPortfolio()

  return (
    <div className="tit-panel-flat flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--tit-border)] px-2 py-1">
        <p className="tit-label">Positions</p>
        {!isConnected ? (
          <button type="button" onClick={() => void connect()} className="tit-btn-accent px-2 py-0.5 text-[0.55rem]">
            Connect
          </button>
        ) : null}
      </div>
      {!isConnected ? (
        <p className="p-2 text-[0.65rem] text-[var(--tit-text-1)]">Connect wallet to load positions.</p>
      ) : loading && !data ? (
        <div className="space-y-1 p-2" aria-busy>
          <div className="tit-skeleton h-4 w-full" />
          <div className="tit-skeleton h-4 w-5/6" />
        </div>
      ) : error ? (
        <p className="p-2 text-[var(--tit-neg)]">{error}</p>
      ) : !data?.positions.length ? (
        <p className="p-2 text-[0.65rem] text-[var(--tit-text-1)]">No open positions.</p>
      ) : (
        <div className="tit-scroll min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[var(--tit-bg-2)]">
              <tr className="tit-label text-[0.5rem]">
                <th className="px-2 py-1 font-bold">Token</th>
                <th className="px-2 py-1 font-bold">Value</th>
                <th className="px-2 py-1 font-bold">Risk</th>
                <th className="px-2 py-1 font-bold">Verdict</th>
                <th className="px-2 py-1 font-bold" />
              </tr>
            </thead>
            <tbody>
              {data.positions.map((p) => (
                <tr
                  key={p.mint}
                  className="border-t border-[var(--tit-border)] hover:bg-[var(--tit-bg-3)]"
                  style={{ height: 'var(--tit-row-h)' }}
                >
                  <td className="px-2 py-0.5">
                    <button
                      type="button"
                      onClick={() => selectMint(p.mint, p.symbol)}
                      className="text-[0.65rem] font-semibold text-[var(--tit-text-0)] hover:text-[var(--tit-accent-bright)]"
                    >
                      {p.symbol}
                    </button>
                  </td>
                  <td className="tit-mono px-2 py-0.5 text-[0.6rem] text-[var(--tit-text-1)]">
                    ${p.valueUsd.toFixed(2)}
                  </td>
                  <td className="tit-mono px-2 py-0.5 text-[0.6rem]">{p.riskScore}</td>
                  <td
                    className={`tit-mono px-2 py-0.5 text-[0.55rem] font-bold ${
                      p.verdict === 'DANGER' || p.verdict === 'BLOCKED'
                        ? 'text-[var(--tit-danger)]'
                        : p.verdict === 'CAUTION'
                          ? 'text-[var(--tit-caution)]'
                          : 'text-[var(--tit-safe)]'
                    }`}
                  >
                    {p.verdict}
                  </td>
                  <td className="px-2 py-0.5 text-right">
                    <button
                      type="button"
                      onClick={() => armExit(p.mint, p.symbol)}
                      className="rounded border border-[var(--tit-border)] px-1.5 py-0.5 text-[0.5rem] font-bold text-[var(--tit-text-1)] hover:border-[var(--tit-danger)] hover:text-[var(--tit-danger)]"
                    >
                      Exit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RecentTradesPanel() {
  const [tick, setTick] = useState(0)
  const trades = useMemo(() => {
    void tick
    return loadTradeLog().slice(0, 12)
  }, [tick])

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 5_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="tit-panel-flat flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-[var(--tit-border)] px-2 py-1">
        <p className="tit-label">Recent Trades</p>
      </div>
      {trades.length === 0 ? (
        <p className="p-2 text-[0.65rem] text-[var(--tit-text-1)]">
          No terminal fills yet. Confirmed swaps appear here.
        </p>
      ) : (
        <ul className="tit-scroll min-h-0 flex-1 overflow-y-auto">
          {trades.map((t) => (
            <li
              key={t.signature}
              className="flex items-center gap-2 border-t border-[var(--tit-border)] px-2"
              style={{ height: 'var(--tit-row-h)' }}
            >
              <span
                className={`tit-mono text-[0.55rem] font-bold ${
                  t.side === 'buy' ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                }`}
              >
                {t.side.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.65rem]">{t.symbol}</span>
              {t.verdictAtTrade ? (
                <span className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">
                  {t.verdictAtTrade}
                </span>
              ) : null}
              <span className="tit-mono text-[0.5rem] text-[var(--tit-text-2)]">
                {new Date(t.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function IntelFeedPanel({ rows }: { rows: UnifiedSignal[] }) {
  const { selectSignal } = useTerminalFocus()

  return (
    <div className="tit-panel-flat flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-[var(--tit-border)] px-2 py-1">
        <p className="tit-label">Intel Feed</p>
      </div>
      {rows.length === 0 ? (
        <p className="p-2 text-[0.65rem] text-[var(--tit-text-1)]">Waiting for live signals…</p>
      ) : (
        <ul className="tit-scroll min-h-0 flex-1 overflow-y-auto">
          {rows.slice(0, 40).map((r) => {
            const mint = r.contractAddress
            return (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={!mint}
                  onClick={() => mint && selectSignal(r)}
                  className="flex w-full items-start gap-2 border-t border-[var(--tit-border)] px-2 py-1 text-left hover:bg-[var(--tit-bg-3)] disabled:opacity-50"
                >
                  <span className="tit-mono shrink-0 text-[0.5rem] text-[var(--tit-text-2)]">
                    {new Date(r.msgTimestamp || r.ingestTimestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span className="min-w-0 flex-1 text-[0.6rem] text-[var(--tit-text-0)]">
                    <span className="font-semibold text-[var(--tit-accent-bright)]">
                      {r.sourceTag}
                    </span>{' '}
                    {r.label || r.tokenSymbol || 'signal'}
                    {r.verdict !== 'scanning' ? (
                      <span className="text-[var(--tit-text-2)]"> · {r.verdict}</span>
                    ) : null}
                    {r.sample ? <span className="tit-sample-tag ml-1">sample</span> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

type Props = { intelRows: UnifiedSignal[] }

/** Bottom strip — Portions · Positions · Recent Trades · Intel Feed */
export function BottomDeck({ intelRows }: Props) {
  const { data } = useTerminalPortfolio()

  return (
    <div className="grid h-full min-h-0 grid-cols-[160px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1">
      <PortionsDonut positions={data?.positions ?? []} total={data?.totalValueUsd ?? 0} />
      <PositionsTable />
      <RecentTradesPanel />
      <IntelFeedPanel rows={intelRows} />
    </div>
  )
}
