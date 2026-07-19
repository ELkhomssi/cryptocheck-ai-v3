'use client'

import Link from 'next/link'
import { Flame, Filter } from 'lucide-react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { formatAge } from '@/lib/signals-dashboard/format'
import type { HotSortKey } from '@/lib/command-center/stats'
import { ScoreRing } from './primitives/ScoreRing'
import { RankBadge } from './primitives/RankBadge'
import { SectionHeader } from './primitives/SectionHeader'
import { SkeletonRows } from './primitives/SkeletonBlock'
import { ScanButton } from './ScanButton'
import { SwapButton } from './SwapButton'

export type HotOpportunitiesTableProps = {
  rows: UnifiedSignal[]
  loading: boolean
  sort: HotSortKey
  onSort: (s: HotSortKey) => void
  filter24h: boolean
  onFilter24h: (v: boolean) => void
  onScan: (signal: UnifiedSignal) => void
  onSwap: (signal: UnifiedSignal) => void
  recentIds: Set<string>
  reconnecting?: boolean
}

function TokenAvatar({ symbol }: { symbol: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dash-hairline bg-dash-greenDeep text-sm font-bold text-dash-green">
      {symbol.slice(0, 1).toUpperCase()}
    </span>
  )
}

function DataCol({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden min-w-[4.5rem] sm:block">
      <p className="text-[11px] text-dash-tlo">{label}</p>
      <p className="font-dash-mono text-[13px] tabular-nums text-dash-thi">{value}</p>
    </div>
  )
}

function SmartMoneyCol({ count }: { count: number }) {
  const n = Math.min(3, Math.max(0, count))
  return (
    <div className="hidden min-w-[5rem] lg:block">
      <p className="text-[11px] text-dash-tlo">Smart Money</p>
      <div className="mt-1 flex items-center gap-1">
        {n > 0 ? (
          <div className="flex -space-x-1.5">
            {Array.from({ length: n }).map((_, i) => (
              <span
                key={i}
                className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-dash-bg bg-dash-greenDeep text-[8px] font-bold text-dash-green"
              >
                W
              </span>
            ))}
          </div>
        ) : (
          <span className="font-dash-mono text-[13px] text-dash-thi">—</span>
        )}
        {count > 0 ? (
          <span className="font-dash-mono text-[11px] text-dash-tlo">{count}</span>
        ) : null}
      </div>
    </div>
  )
}

function payloadStr(signal: UnifiedSignal, key: string): string {
  const v = signal.rawPayload?.[key]
  if (v == null || v === '') return '—'
  if (typeof v === 'number') return v.toLocaleString()
  return String(v)
}

function ListeningRow() {
  return (
    <div className="rounded-dash-inner border border-dashed border-dash-innerline px-4 py-6 text-center">
      <p className="animate-shimmer text-xs text-dash-tlo">Listening for opportunities…</p>
    </div>
  )
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
  reconnecting,
}: HotOpportunitiesTableProps) {
  return (
    <section id="hot-opportunities" className="rounded-dash border border-dash-hairline bg-dash-panel">
      <div className="border-b border-dash-innerline px-4 py-3 md:px-5">
        <SectionHeader
          icon={Flame}
          title="HOT OPPORTUNITIES"
          subtitle="Real-time AI-ranked opportunities"
          action={
            <div className="flex items-center gap-2">
              {reconnecting ? (
                <span className="rounded-dash-pill bg-dash-amber/15 px-2 py-0.5 text-[10px] text-dash-amber">
                  Reconnecting…
                </span>
              ) : null}
              <select
                value={sort}
                onChange={(e) => onSort(e.target.value as HotSortKey)}
                className="font-dash-mono rounded-dash-chip border border-dash-innerline bg-dash-inset px-2 py-1 text-[11px] text-dash-tmid transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
                aria-label="Sort by"
              >
                <option value="score">AI Score</option>
                <option value="age">Age</option>
                <option value="liquidity">Mentions</option>
              </select>
              <button
                type="button"
                onClick={() => onFilter24h(!filter24h)}
                className={`font-dash-mono rounded-dash-chip border px-2 py-1 text-[11px] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green ${
                  filter24h
                    ? 'border-dash-green/40 bg-dash-greenDim text-dash-green'
                    : 'border-dash-innerline text-dash-tmid hover:border-white/20'
                }`}
              >
                24H
              </button>
              <button
                type="button"
                className="rounded-dash-chip border border-dash-innerline p-1.5 text-dash-tlo transition-colors duration-150 hover:border-white/20 hover:text-dash-thi"
                aria-label="Filters"
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>
          }
        />
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : rows.length === 0 ? (
        <div className="p-4">
          <ListeningRow />
        </div>
      ) : (
        <div className="space-y-2 p-3 md:p-4">
          {rows.map((row, i) => {
            const swapDisabled = row.verdict === 'scanning' || !row.contractAddress
            return (
              <article
                key={row.id}
                className={`flex flex-wrap items-center gap-3 rounded-dash-inner border border-dash-innerline bg-dash-panel2 px-3 py-3 transition-colors duration-150 hover:bg-dash-inset ${
                  recentIds.has(row.id) ? 'animate-slide-in border-dash-green/30' : ''
                }`}
              >
                <RankBadge n={i + 1} />
                <div className="flex min-w-[140px] flex-1 items-center gap-2">
                  <TokenAvatar symbol={row.tokenSymbol ?? row.label} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-dash-thi">{row.label}</p>
                    <p className="text-[11px] text-dash-tmid">
                      {row.tokenSymbol ?? '—'} · {row.chain ?? 'solana'}
                    </p>
                  </div>
                </div>
                <DataCol label="Market Cap" value={payloadStr(row, 'marketCap')} />
                <DataCol label="Liquidity" value={payloadStr(row, 'liquidity')} />
                <DataCol label="Age" value={formatAge(row.msgTimestamp)} />
                <DataCol label="Holders" value={payloadStr(row, 'holders')} />
                <SmartMoneyCol count={row.sourceCount ?? 0} />
                <DataCol label="Mentions" value={String(row.sourceCount ?? 1)} />
                <ScoreRing value={row.scoreValue ?? 0} size={44} stroke={3} label="AI Score" />
                <div className="flex gap-2">
                  <ScanButton onClick={() => onScan(row)} disabled={!row.contractAddress} />
                  <SwapButton
                    onClick={() => onSwap(row)}
                    disabled={swapDisabled}
                    title={swapDisabled ? 'Awaiting scan verdict' : undefined}
                  />
                </div>
                {row.sample ? (
                  <span className="rounded border border-dash-innerline px-1.5 py-0.5 text-[9px] font-bold uppercase text-dash-tlo">
                    Sample
                  </span>
                ) : null}
              </article>
            )
          })}
          {rows.length < 5 ? <ListeningRow /> : null}
        </div>
      )}

      <footer className="border-t border-dash-innerline py-3 text-center">
        <Link
          href="/dashboard#hot-opportunities"
          className="text-xs font-semibold text-dash-green transition-colors duration-150 hover:text-dash-greenHi hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
        >
          View All Opportunities
        </Link>
      </footer>
    </section>
  )
}
