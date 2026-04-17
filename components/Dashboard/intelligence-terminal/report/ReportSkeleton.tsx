'use client'

/**
 * ReportSkeleton — Phase 4D
 *
 * Shown while `currentScan.status === 'loading'`. Mirrors the real
 * ReportGrid layout so when the populated state arrives the user's
 * eye doesn't have to re-anchor.
 *
 * Placeholder blocks use a subtle motion-safe pulse; reduced-motion
 * users get a static dimmer version via the global CSS rule.
 */

import { Card } from '../primitives/Card'

function Bar({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`rounded-md bg-white/5 motion-safe:animate-pulse ${className}`}
    />
  )
}

export function ReportSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading intelligence report"
      className="mt-8 flex flex-col gap-4 md:gap-6"
    >
      <span className="sr-only">Loading report…</span>

      {/* Identity strip */}
      <Card className="flex items-center gap-4 px-6 py-4">
        <div className="h-10 w-10 shrink-0 rounded-full bg-white/5 motion-safe:animate-pulse" />
        <div className="flex-1 space-y-2">
          <Bar className="h-4 w-40" />
          <Bar className="h-3 w-64" />
        </div>
      </Card>

      {/* Risk + Metrics split */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr] md:gap-6">
        <Card className="min-h-[360px] p-6 md:p-10">
          <Bar className="h-3 w-48" />
          <div className="mt-8 flex items-center gap-10">
            <div className="space-y-4">
              <Bar className="h-20 w-36" />
              <Bar className="h-6 w-28" />
            </div>
            <div className="hidden md:block">
              <Bar className="h-40 w-60 rounded-t-full" />
            </div>
          </div>
          <div className="mt-10 space-y-3 border-t border-white/5 pt-6">
            <Bar className="h-3 w-24" />
            <Bar className="h-8 w-full" />
            <Bar className="h-8 w-full" />
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 md:gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Bar className="h-3 w-20" />
              <Bar className="mt-3 h-7 w-24" />
              <Bar className="mt-3 h-3 w-16" />
            </Card>
          ))}
        </div>
      </div>

      {/* Authorities */}
      <Card className="px-5 py-4">
        <Bar className="h-3 w-24" />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Bar className="h-12 flex-1" />
          <Bar className="h-12 flex-1" />
          <Bar className="h-12 flex-1" />
        </div>
      </Card>

      {/* Holder + Liquidity row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 md:gap-6">
        <Card className="p-5">
          <Bar className="h-3 w-32" />
          <Bar className="mt-4 h-3 w-full" />
          <Bar className="mt-4 h-12 w-full" />
        </Card>
        <Card className="p-5">
          <Bar className="h-3 w-24" />
          <div className="mt-3 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/5 motion-safe:animate-pulse" />
            <div className="flex-1 space-y-2">
              <Bar className="h-4 w-32" />
              <Bar className="h-3 w-48" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
