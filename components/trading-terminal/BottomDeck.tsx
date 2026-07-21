'use client'

import { useEffect, useMemo, useState } from 'react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { getTerminalSnapshot } from '@/lib/trading-terminal/data/adapters'
import type { IntelEvent } from '@/lib/trading-terminal/data/types'
import { loadTradeLog } from '@/lib/trading-terminal/trade-log'
import { useTerminalPortfolio } from './MiniPortfolioCard'
import { useTerminalFocus } from './TerminalFocusProvider'

function PortionsPanel() {
  const { dataMode } = useTerminalFocus()
  const { data } = useTerminalPortfolio()
  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])

  if (dataMode === 'demo' && snap.portions.status === 'ready') {
    const p = snap.portions.data
    return (
      <div className="tit-panel-flat flex h-full min-h-0 flex-col overflow-hidden">
        <div className="border-b border-[var(--tit-border)] px-2 py-1">
          <p className="tit-label">Portions</p>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-1 p-2">
          <p className="tit-mono text-[0.95rem] font-bold text-[var(--tit-text-0)]">
            ${p.totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p
            className={`tit-mono text-[0.65rem] ${
              p.pnl24hUsd >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
            }`}
          >
            {p.pnl24hUsd >= 0 ? '▲' : '▼'} ${Math.abs(p.pnl24hUsd).toFixed(2)} ({p.pnl24hPct >= 0 ? '+' : ''}
            {p.pnl24hPct.toFixed(2)}%)
          </p>
          <ul className="mt-1 space-y-0.5">
            {p.legend.map((l) => (
              <li key={l.name} className="flex justify-between text-[0.55rem]">
                <span className="text-[var(--tit-text-1)]">{l.name}</span>
                <span className="tit-mono text-[var(--tit-text-0)]">{l.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  const positions = data?.positions ?? []
  const total = data?.totalValueUsd ?? 0
  return (
    <div className="tit-panel-flat flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-[var(--tit-border)] px-2 py-1">
        <p className="tit-label">Portions</p>
      </div>
      <div className="flex flex-1 items-center p-2">
        {total <= 0 ? (
          <p className="text-[0.65rem] text-[var(--tit-text-1)]">Connect a wallet to analyze allocation.</p>
        ) : (
          <ul className="w-full space-y-0.5">
            {positions.slice(0, 4).map((p) => (
              <li key={p.mint} className="flex justify-between text-[0.6rem]">
                <span className="text-[var(--tit-text-1)]">{p.symbol}</span>
                <span className="tit-mono">{((p.valueUsd / total) * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function PositionsTable() {
  const { dataMode, selectMint, armExit } = useTerminalFocus()
  const { data, error, loading, isConnected, connect } = useTerminalPortfolio()
  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])

  const rows =
    dataMode === 'demo' && snap.positions.status === 'ready'
      ? snap.positions.data
      : (data?.positions ?? []).map((p) => ({
          mint: p.mint,
          symbol: p.symbol,
          size: 0,
          entryUsd: 0,
          priceUsd: 0,
          pnlUsd: 0,
          pnlPct: 0,
          change24hPct: 0,
          valueUsd: p.valueUsd,
          verdict: (p.verdict as 'SAFE' | 'CAUTION' | 'DANGER') || 'CAUTION',
          riskScore: p.riskScore,
        }))

  return (
    <div className="tit-panel-flat flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--tit-border)] px-2 py-1">
        <p className="tit-label">Positions</p>
        {dataMode === 'live' && !isConnected ? (
          <button type="button" onClick={() => void connect()} className="tit-btn-accent px-2 py-0.5 text-[0.55rem]">
            Connect
          </button>
        ) : null}
      </div>
      {dataMode === 'live' && !isConnected ? (
        <p className="p-2 text-[0.65rem] text-[var(--tit-text-1)]">Connect a wallet to load positions.</p>
      ) : loading && dataMode === 'live' && !data ? (
        <div className="space-y-1 p-2" aria-busy>
          <div className="tit-skeleton h-4 w-full" />
        </div>
      ) : error && dataMode === 'live' ? (
        <p className="p-2 text-[var(--tit-neg)]">{error}</p>
      ) : rows.length === 0 ? (
        <p className="p-2 text-[0.65rem] text-[var(--tit-text-1)]">No open positions.</p>
      ) : (
        <div className="tit-scroll min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[var(--tit-bg-2)]">
              <tr className="tit-label text-[0.5rem]">
                <th className="px-2 py-1">Token</th>
                <th className="px-2 py-1">Value</th>
                <th className="px-2 py-1">P/L%</th>
                <th className="px-2 py-1">Risk</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
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
                  <td className="tit-mono px-2 py-0.5 text-[0.6rem]">${p.valueUsd.toFixed(2)}</td>
                  <td
                    className={`tit-mono px-2 py-0.5 text-[0.6rem] ${
                      p.pnlPct >= 0 ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-neg)]'
                    }`}
                  >
                    {p.pnlPct === 0 && dataMode === 'live'
                      ? '—'
                      : `${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(1)}%`}
                  </td>
                  <td className="tit-mono px-2 py-0.5 text-[0.55rem]">{p.riskScore}</td>
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
  const { dataMode } = useTerminalFocus()
  const [tick, setTick] = useState(0)
  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])
  const liveTrades = useMemo(() => {
    void tick
    return loadTradeLog().slice(0, 12)
  }, [tick])

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 5_000)
    return () => window.clearInterval(id)
  }, [])

  const demo = dataMode === 'demo' && snap.trades.status === 'ready' ? snap.trades.data : null

  return (
    <div className="tit-panel-flat flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-[var(--tit-border)] px-2 py-1">
        <p className="tit-label">Recent Trades</p>
      </div>
      {demo ? (
        <ul className="tit-scroll min-h-0 flex-1 overflow-y-auto">
          {demo.map((t) => (
            <li
              key={t.id}
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
              <span className="tit-badge tit-badge-trend">{t.coachTag}</span>
            </li>
          ))}
        </ul>
      ) : liveTrades.length === 0 ? (
        <p className="p-2 text-[0.65rem] text-[var(--tit-text-1)]">No terminal fills yet.</p>
      ) : (
        <ul className="tit-scroll min-h-0 flex-1 overflow-y-auto">
          {liveTrades.map((t) => (
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function intelIcon(kind: IntelEvent['kind']): string {
  if (kind.includes('buy') || kind === 'whale_accumulation') return '▲'
  if (kind.includes('sell')) return '▼'
  return '●'
}

function IntelFeedPanel({ liveRows }: { liveRows: UnifiedSignal[] }) {
  const { dataMode, selectMint, selectSignal } = useTerminalFocus()
  const snap = useMemo(() => getTerminalSnapshot(dataMode), [dataMode])

  // PROMPT 12: never show Telegram as institutional intel
  const onChainOnly = useMemo(() => {
    return liveRows.filter((r) => {
      const tag = String(r.sourceTag || '').toLowerCase()
      return tag !== 'telegram' && !tag.includes('telegram')
    })
  }, [liveRows])

  if (dataMode === 'demo' && snap.intel.status === 'ready') {
    return (
      <div className="tit-panel-flat flex h-full min-h-0 flex-col overflow-hidden">
        <div className="border-b border-[var(--tit-border)] px-2 py-1">
          <p className="tit-label">Intel Feed</p>
        </div>
        <ul className="tit-scroll min-h-0 flex-1 overflow-y-auto">
          {snap.intel.data.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                disabled={!ev.mint}
                onClick={() => ev.mint && selectMint(ev.mint, ev.symbol || undefined)}
                className="flex w-full items-start gap-2 border-t border-[var(--tit-border)] px-2 py-1.5 text-left hover:bg-[var(--tit-bg-3)] disabled:opacity-50"
              >
                <span className="tit-mono text-[0.55rem] text-[var(--tit-accent)]">
                  {intelIcon(ev.kind)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.65rem] font-semibold text-[var(--tit-text-0)]">
                    {ev.headline}
                  </span>
                  <span className="block text-[0.55rem] text-[var(--tit-text-1)]">{ev.detail}</span>
                </span>
                <span className="tit-mono shrink-0 text-[0.45rem] text-[var(--tit-text-2)]">
                  {new Date(ev.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="tit-panel-flat flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-[var(--tit-border)] px-2 py-1">
        <p className="tit-label">Intel Feed</p>
      </div>
      {onChainOnly.length === 0 ? (
        <p className="p-2 text-[0.65rem] text-[var(--tit-text-1)]">
          On-chain intel stream connecting…
        </p>
      ) : (
        <ul className="tit-scroll min-h-0 flex-1 overflow-y-auto">
          {onChainOnly.slice(0, 40).map((r) => {
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
                    })}
                  </span>
                  <span className="min-w-0 flex-1 text-[0.6rem] text-[var(--tit-text-0)]">
                    <span className="font-semibold text-[var(--tit-accent-bright)]">
                      {r.sourceTag}
                    </span>{' '}
                    {r.label || r.tokenSymbol || 'event'}
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

export function BottomDeck({ intelRows }: Props) {
  return (
    <div className="grid h-full min-h-0 grid-cols-[160px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1">
      <PortionsPanel />
      <PositionsTable />
      <RecentTradesPanel />
      <IntelFeedPanel liveRows={intelRows} />
    </div>
  )
}
