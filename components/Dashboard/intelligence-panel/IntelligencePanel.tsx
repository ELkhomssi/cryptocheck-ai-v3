'use client'
import { useState } from 'react'
import { MarketScanPanel } from './panels/MarketScanPanel'
import { AISignalPanel } from './panels/AISignalPanel'
import { TrackedOpportunitiesPanel } from './panels/TrackedOpportunitiesPanel'
import { BankrollCurvePanel } from './panels/BankrollCurvePanel'
import { RelationshipGraphPanel } from './panels/RelationshipGraphPanel'
import { OrderDepthPanel } from './panels/OrderDepthPanel'
import { WhaleTrackerPanel } from './panels/WhaleTrackerPanel'
import { ExitSignalsPanel } from './panels/ExitSignalsPanel'
import { RiskMonitorPanel } from './panels/RiskMonitorPanel'
import { DisclaimerBanner } from '@/components/legal/DisclaimerBanner'

export function IntelligencePanel({ mint: initialMint }: { mint: string }) {
  const [mint, setMint] = useState(initialMint)
  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <DisclaimerBanner variant="ai" />
      <div className="mt-3 flex flex-col gap-2 rounded border border-cyan-500/20 bg-slate-900/50 p-3 sm:flex-row sm:items-center">
        <label htmlFor="intel-mint" className="text-xs text-slate-400">
          Mint
        </label>
        <input
          id="intel-mint"
          value={mint}
          onChange={(e) => setMint(e.target.value.trim())}
          placeholder="Paste Solana mint"
          className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500/40"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Row 1 */}
        <MarketScanPanel mint={mint} />
        <AISignalPanel mint={mint} />
        <TrackedOpportunitiesPanel />

        {/* Row 2 */}
        <BankrollCurvePanel />
        <RelationshipGraphPanel mint={mint} />
        <OrderDepthPanel mint={mint} />

        {/* Row 3 */}
        <WhaleTrackerPanel mint={mint} />
        <div className="lg:col-span-1">
          <div className="py-4 text-center text-sm text-slate-500">
            Agent Vote (shown in AI Signal Panel above)
          </div>
        </div>
        <ExitSignalsPanel />

        {/* Row 4 */}
        <RiskMonitorPanel mint={mint} />
      </div>
    </div>
  )
}
