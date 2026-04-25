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
import { Cpu } from 'lucide-react'

export function IntelligencePanel({ mint: initialMint }: { mint: string }) {
  const [mint, setMint] = useState(initialMint)

  return (
    <div className="relative w-full max-w-[1800px]">
      <DisclaimerBanner variant="ai" />

      <header className="mb-6 mt-2 border-b border-white/[0.08] pb-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono-terminal text-xs font-bold uppercase tracking-[0.25em] text-cyan-400/80">
              Intelligence Terminal
            </p>
            <h1 className="mt-1 font-space text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              <span className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-emerald-200 bg-clip-text text-transparent">
                Analysis Console
              </span>
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-400">
              Multi-source Solana intelligence — unified with the institutional dashboard shell.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 font-mono-terminal text-xs text-emerald-200/90 sm:mt-0">
            <Cpu className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            <span>Live diagnostics · read-only</span>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-cyan-500/25 bg-slate-950/70 p-4 shadow-[0_0_24px_rgba(34,211,238,0.06)] backdrop-blur-sm sm:flex-row sm:items-center">
          <label htmlFor="intel-mint" className="font-space text-xs font-bold uppercase tracking-widest text-fuchsia-300/90">
            Target mint
          </label>
          <input
            id="intel-mint"
            value={mint}
            onChange={(e) => setMint(e.target.value.trim())}
            placeholder="Paste Solana mint address"
            className="w-full rounded-xl border border-white/10 bg-[#020617] px-4 py-3 font-mono-terminal text-sm font-semibold text-slate-100 outline-none ring-cyan-500/30 transition-shadow placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-2"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <MarketScanPanel mint={mint} />
        <AISignalPanel mint={mint} />
        <TrackedOpportunitiesPanel />

        <BankrollCurvePanel />
        <RelationshipGraphPanel mint={mint} />
        <OrderDepthPanel mint={mint} />

        <WhaleTrackerPanel mint={mint} />
        <div className="lg:col-span-1">
          <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-2xl border border-dashed border-fuchsia-500/25 bg-slate-950/40 px-4 py-6 text-center">
            <Cpu className="mb-2 h-8 w-8 text-fuchsia-400/70" aria-hidden />
            <p className="font-space text-sm font-bold uppercase tracking-widest text-fuchsia-200/80">
              Agent consensus
            </p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              Verdict and rationale for this mint appear in the AI Signal panel above.
            </p>
          </div>
        </div>
        <ExitSignalsPanel />

        <RiskMonitorPanel mint={mint} />
      </div>
    </div>
  )
}
