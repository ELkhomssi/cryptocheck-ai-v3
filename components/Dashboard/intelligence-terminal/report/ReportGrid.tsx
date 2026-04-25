'use client'

/**
 * ReportGrid — Phase 4D
 *
 * Desktop (≥lg):
 *   ┌────────────────────────────────────────────────────┐
 *   │ TokenIdentityStrip                                 │
 *   ├──────────────────────┬─────────────────────────────┤
 *   │ SentinelRiskCard     │ BasicMetricsGrid            │
 *   ├──────────────────────┴─────────────────────────────┤
 *   │ AuthoritiesStrip  (v2)                             │
 *   ├──────────────────────┬─────────────────────────────┤
 *   │ HolderChart   (v2)   │ LiquidityLockCard (v2)      │
 *   └──────────────────────┴─────────────────────────────┘
 *
 * Mobile: single column, priority order.
 * v1 users see UpgradeTeaser in place of rows 3–4.
 *
 * Phase 4D adds:
 *   • CardErrorBoundary around every card.
 *   • Staggered `card-enter` animation on first render.
 *   • Ticker polling while a report is present.
 */

import type { ReactNode } from 'react'
import type { TokenIntelligenceReport } from '@/lib/types/intelligence'
import { useTickerPolling } from '../hooks/useTickerPolling'
import { CardErrorBoundary } from '../primitives/CardErrorBoundary'
import { AuthoritiesStrip } from './AuthoritiesStrip'
import { BasicMetricsGrid } from './BasicMetricsGrid'
import { HolderChart } from './HolderChart'
import { LiquidityLockCard } from './LiquidityLockCard'
import { SentinelRiskCard } from './SentinelRiskCard'
import { TokenIdentityStrip } from './TokenIdentityStrip'
import { UpgradeTeaser } from './UpgradeTeaser'

const STAGGER_STEP = 60 // ms between card appearances

/** Single wrapper: adds a staggered entry animation + error boundary. */
function Stage({
  index,
  label,
  children,
  className = '',
}: {
  index: number
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`motion-safe:animate-[card-enter_400ms_cubic-bezier(0.16,1,0.3,1)_both] ${className}`}
      style={{ animationDelay: `${index * STAGGER_STEP}ms` }}
    >
      <CardErrorBoundary label={label}>{children}</CardErrorBoundary>
    </div>
  )
}

export function ReportGrid({
  report,
}: {
  report: TokenIntelligenceReport
}) {
  useTickerPolling(report.mint)
  const isV2 = report.meta.keyTier === 'v2'

  return (
    <div className="mt-8 flex flex-col gap-4 md:gap-6">
      <Stage index={0} label="Identity">
        <TokenIdentityStrip report={report} />
      </Stage>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr] md:gap-6">
        <Stage index={1} label="Sentinel Risk">
          <SentinelRiskCard report={report} />
        </Stage>
        <Stage index={2} label="Basic Metrics">
          <BasicMetricsGrid report={report} />
        </Stage>
      </div>

      {isV2 ? (
        <>
          <Stage index={3} label="Authorities">
            <AuthoritiesStrip report={report} />
          </Stage>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 md:gap-6">
            <Stage index={4} label="Holder distribution">
              <HolderChart report={report} />
            </Stage>
            <Stage index={5} label="Liquidity lock">
              <LiquidityLockCard report={report} />
            </Stage>
          </div>
        </>
      ) : (
        <Stage index={3} label="Upgrade">
          <UpgradeTeaser />
        </Stage>
      )}
    </div>
  )
}
