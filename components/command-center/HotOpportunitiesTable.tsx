'use client'

import Link from 'next/link'
import { Flame, Filter } from 'lucide-react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { formatAge } from '@/lib/signals-dashboard/format'
import type { HotSortKey } from '@/lib/command-center/stats'
import { ScoreRing } from './ScoreRing'
import { SkeletonRows } from './SkeletonRows'
import { EmptyState } from './EmptyState'

type Props = {
  rows: UnifiedSignal[]
  loading: boolean
  sort: HotSortKey
  onSort: (s: HotSortKey) => void
  filter24h: boolean
  onFilter24h: (v: boolean) => void
  onScan: (signal: UnifiedSignal) => void
  onSwap: (signal: UnifiedSignal) => void
  recentIds: Set<string>
}

export function HotOpportunitiesTable({
  rows,
  loading,
  sort,
  onSort,
  filter24h,
  onFilter24h,
  onScan,
  onSwap,
  recentIds,
}: Props) {
  return (
    <section className="cc-panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cc-inner)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-[var(--cc-orange)]" />
          <div>
            <p className="cc-label text-[var(--cc-hi)]">Hot Opportunities</p>
            <p className="text-[0.65rem] text-[var(--cc-lo)]">Real-time AI-ranked opportunities</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as HotSortKey)}
            className="cc-mono rounded-lg border border-[var(--cc-inner)] bg-[var(--cc-panel-2)] px-2 py-1.5 text-[0.65rem] text-[var(--cc-mid)]"
            aria-label="Sort opportunities"
          >
            <option value="score">AI Score</option>
            <option value="age">Age</option>
            <option value="liquidity">Mentions</option>
          </select>
          <button
            type="button"
            onClick={() => onFilter24h(!filter24h)}
            className={`cc-mono rounded-lg border px-2 py-1.5 text-[0.65rem] ${
              filter24h
                ? 'border-[var(--cc-green)]/40 bg-[var(--cc-green-dim)] text-[var(--cc-green)]'
                : 'border-[var(--cc-inner)] text-[var(--cc-mid)]'
            }`}
          >
            24H
          </button>
          <Filter className="h-4 w-4 text-[var(--cc-lo)]" aria-hidden />
        </div>
      </header>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Listening for opportunities"
          detail="Ranked token signals appear here as the Master Feed ingests and scores live channels."
          className="border-0 bg-transparent"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--cc-inner)] text-[var(--cc-lo)]">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Token</th>
                <th className="px-3 py-2 font-medium">Age</th>
                <th className="px-3 py-2 font-medium">Mentions</th>
                <th className="px-3 py-2 font-medium">Sources</th>
                <th className="px-3 py-2 font-medium">AI Score</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-[var(--cc-inner)]/60 hover:bg-white/[0.02] ${
                    recentIds.has(row.id) ? 'cc-row-enter bg-[var(--cc-green-dim)]' : ''
                  }`}
                >
                  <td className="cc-mono px-3 py-3 text-[var(--cc-lo)]">{i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <TokenAvatar symbol={row.tokenSymbol ?? row.label} />
                      <div>
                        <p className="font-semibold text-[var(--cc-hi)]">{row.label}</p>
                        {row.contractAddress ? (
                          <p className="cc-mono text-[0.58rem] text-[var(--cc-lo)]">
                            {row.contractAddress.slice(0, 4)}…{row.contractAddress.slice(-4)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="cc-mono px-3 py-3 text-[var(--cc-mid)]">{formatAge(row.msgTimestamp)}</td>
                  <td className="cc-mono px-3 py-3 text-[var(--cc-mid)]">{row.sourceCount ?? 1}</td>
                  <td className="px-3 py-3 text-[var(--cc-mid)]">{row.sources?.[0] ?? '—'}</td>
                  <td className="px-3 py-3">
                    <ScoreRing score={row.scoreValue ?? 0} size={44} stroke={3} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onScan(row)}
                        className="rounded-lg border border-[var(--cc-inner)] px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-wider text-[var(--cc-mid)] hover:text-[var(--cc-hi)]"
                      >
                        Scan
                      </button>
                      <button
                        type="button"
                        onClick={() => onSwap(row)}
                        disabled={row.verdict === 'scanning' || !row.contractAddress}
                        className="rounded-lg bg-[var(--cc-green)] px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-[var(--cc-bg)] disabled:opacity-40"
                      >
                        Swap
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length < 5 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[var(--cc-lo)]">
                    <span className="cc-shimmer inline-block rounded px-3 py-1 text-[0.65rem]">
                      Listening for more opportunities…
                    </span>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <footer className="border-t border-[var(--cc-inner)] px-4 py-3 text-center">
        <Link
          href="/dashboard/signals"
          className="text-xs font-semibold text-[var(--cc-green)] hover:underline"
        >
          View All Opportunities →
        </Link>
      </footer>
    </section>
  )
}

function TokenAvatar({ symbol }: { symbol: string }) {
  const letter = symbol.slice(0, 1).toUpperCase()
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--cc-green-deep)] text-xs font-bold text-[var(--cc-green)] ring-1 ring-[var(--cc-hairline)]">
      {letter}
    </span>
  )
}
