'use client'

import Link from 'next/link'
import { useVerifiedCryptocheckAccessKey } from '@/lib/hooks/useVerifiedCryptocheckAccessKey'

/**
 * Compact dashboard header indicator: verified access key vs link to Analysis Console.
 */
export function AccessKeyHeaderChip() {
  const { ready, hasValidKey } = useVerifiedCryptocheckAccessKey()

  if (!ready) {
    return (
      <span className="hidden items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 font-mono-terminal text-[0.58rem] font-semibold uppercase tracking-wider text-slate-500 lg:inline-flex">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500" aria-hidden />
        Key
      </span>
    )
  }

  if (hasValidKey) {
    return (
      <Link
        href="/operator/analysis"
        className="hidden items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono-terminal text-[0.58rem] font-semibold uppercase tracking-wider text-emerald-200/95 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/15 lg:inline-flex"
        title="Access key active — open Analysis Console"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" aria-hidden />
        Key active
      </Link>
    )
  }

  return (
    <Link
      href="/operator/analysis"
      className="hidden items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 font-mono-terminal text-[0.58rem] font-semibold uppercase tracking-wider text-amber-200/90 transition-colors hover:border-amber-400/45 lg:inline-flex"
    >
      Add access key
    </Link>
  )
}
