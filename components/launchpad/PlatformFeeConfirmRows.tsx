'use client'

import { LAUNCHPAD_FEE_NOTE } from '@/lib/launchpad/constants'
import type { PlatformFeeDisclosure } from '@/lib/launchpad/platform-fee'

type Row = { label: string; value: string }

/**
 * Confirm-sheet fee / risk rows — explicit Platform fee line (never buried).
 */
export function PlatformFeeConfirmRows({
  fee,
  slippageBps,
  priceImpactPct,
  routeLabel,
}: {
  fee: PlatformFeeDisclosure
  slippageBps: number
  priceImpactPct: number
  routeLabel?: string
}) {
  const rows: Row[] = [
    {
      label: `Platform fee (${(fee.feeBps / 100).toFixed(2)}%)`,
      value: fee.configured
        ? `${fee.feeAmountHuman}${fee.feeUsd != null ? ` · ~$${fee.feeUsd.toFixed(4)}` : ''}`
        : 'Not configured',
    },
    { label: 'Slippage', value: `${slippageBps} bps` },
    { label: 'Price impact', value: `${priceImpactPct.toFixed(2)}%` },
  ]
  if (routeLabel) rows.push({ label: 'Route', value: routeLabel })

  return (
    <div className="space-y-2 rounded-rd-sm border border-white/10 bg-rd-navy/80 p-3 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-3 text-rd-mid">
          <span>{r.label}</span>
          <span className="font-rd-mono shrink-0 tabular-nums text-rd-hi">{r.value}</span>
        </div>
      ))}
      <p className="border-t border-white/10 pt-2 text-[10px] leading-relaxed text-rd-lo">
        {LAUNCHPAD_FEE_NOTE}
      </p>
    </div>
  )
}
