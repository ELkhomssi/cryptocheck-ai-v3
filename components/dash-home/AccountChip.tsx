import Link from 'next/link'
import { Crown } from 'lucide-react'
import { AccountMenu } from './AccountMenu'

export type AccountChipProps = {
  name: string
  tier: string
}

/** @deprecated Prefer AccountMenu — kept as thin wrapper for existing call sites. */
export function AccountChip({ name, tier }: AccountChipProps) {
  return <AccountMenu name={name} tier={tier} />
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
