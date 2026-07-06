import Link from 'next/link'
import { Crown } from 'lucide-react'

export type AccountChipProps = {
  name: string
  tier: string
}

export function AccountChip({ name, tier }: AccountChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-dash-pill border border-dash-innerline bg-dash-panel2 px-3 py-1.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-dash-greenDeep text-xs font-bold text-dash-green">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <div className="hidden sm:block">
        <p className="text-[13px] font-medium text-dash-thi">{name}</p>
        <p className="text-[10px] uppercase text-dash-tlo">{tier} member</p>
      </div>
    </div>
  )
}

export function UpgradeProChip() {
  return (
    <Link
      href="/app/upgrade"
      className="inline-flex items-center gap-1.5 rounded-dash-chip border border-dash-gold/50 px-3 py-1.5 text-xs font-semibold text-dash-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-gold"
    >
      <Crown className="h-3.5 w-3.5" />
      Upgrade to Pro
    </Link>
  )
}
