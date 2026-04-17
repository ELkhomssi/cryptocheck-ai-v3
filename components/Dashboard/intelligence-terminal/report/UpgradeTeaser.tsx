'use client'

/**
 * UpgradeTeaser — shown to v1 (FREE) keyholders instead of the v2
 * Authorities/Holder/Liquidity cards. A single Card with a lock
 * icon and a CTA into the billing page.
 */

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Card } from '../primitives/Card'

export function UpgradeTeaser() {
  return (
    <Card accent="safe" className="p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          aria-hidden
          className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#00d4aa]/10 ring-1 ring-[#00d4aa]/30"
        >
          <Lock className="h-6 w-6 text-[#00d4aa]" />
        </div>
        <h3 className="font-mono-terminal text-base font-semibold tracking-wide text-slate-100">
          Sentinel Intelligence
        </h3>
        <p className="max-w-sm text-sm text-slate-400">
          Holder distribution, authority status, liquidity lock and insider
          flags are available on Pro and Enterprise tiers.
        </p>
        <Link
          href="/dashboard/billing"
          className="mt-2 inline-flex items-center gap-2 rounded-md bg-[#00d4aa] px-4 py-2 font-mono-terminal text-[11px] font-bold uppercase tracking-[0.2em] text-slate-950 transition-colors hover:bg-[#00d4aa]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
        >
          Upgrade to Sentinel
        </Link>
      </div>
    </Card>
  )
}
