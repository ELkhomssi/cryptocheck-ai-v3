'use client'

/**
 * BasicMetricsGrid — 2×2 grid of price / market-cap / volume /
 * liquidity. Price card reads from the ticker (when present) so it
 * flashes on update; others fall back to the report snapshot.
 */

import type { TokenIntelligenceReport } from '@/lib/types/intelligence'
import { FlashOnChange } from '../primitives/AnimatedNumber'
import { Card } from '../primitives/Card'
import { formatPercent, formatUsdCompact } from '../primitives/format'
import { useTerminal } from '../TerminalProvider'

function MetricCard({
  label,
  value,
  delta,
  flashKey,
  missingTooltip,
}: {
  label: string
  value: string
  delta?: number | null
  flashKey?: number | null
  missingTooltip?: string
}) {
  const isMissing = value === '—'
  const title = isMissing ? missingTooltip : undefined
  return (
    <Card className="p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 font-mono-terminal text-2xl font-semibold tabular-nums text-slate-100 md:text-3xl" title={title}>
        <FlashOnChange value={flashKey ?? null}>{value}</FlashOnChange>
      </div>
      {delta != null && Number.isFinite(delta) ? (
        <div
          className={`mt-2 flex items-center gap-1 font-mono-terminal text-xs tabular-nums ${
            delta >= 0 ? 'text-[#00d4aa]' : 'text-[#ff4757]'
          }`}
        >
          <span aria-hidden>{delta >= 0 ? '↑' : '↓'}</span>
          <span>{formatPercent(Math.abs(delta))}</span>
        </div>
      ) : null}
    </Card>
  )
}

export function BasicMetricsGrid({
  report,
}: {
  report: TokenIntelligenceReport
}) {
  const { state } = useTerminal()
  const tick =
    state.ticker && state.ticker.mint === report.mint ? state.ticker : null

  const price = tick?.price ?? report.price
  const change24h = tick?.change24h ?? report.priceChange24h
  const volume24h = tick?.volume24h ?? report.volume24h

  return (
    <div className="grid grid-cols-2 gap-4 md:gap-5">
      <MetricCard
        label="Price"
        value={formatUsdCompact(price)}
        delta={change24h}
        flashKey={price}
        missingTooltip="No DEX listing found"
      />
      <MetricCard
        label="Market Cap"
        value={formatUsdCompact(report.marketCap)}
        missingTooltip="No DEX listing found"
      />
      <MetricCard
        label="Volume 24h"
        value={formatUsdCompact(volume24h)}
        flashKey={volume24h}
        missingTooltip="No DEX listing found"
      />
      <MetricCard
        label="Liquidity"
        value={formatUsdCompact(report.liquidityUsd)}
        missingTooltip="No DEX listing found"
      />
    </div>
  )
}
