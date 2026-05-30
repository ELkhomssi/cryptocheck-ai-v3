'use client'

import { useState } from 'react'
import { Activity, ArrowLeftRight } from 'lucide-react'
import { IntelligencePanel } from '@/components/Dashboard/intelligence-panel/IntelligencePanel'
import { RiskGatedSwapPanel } from '@/components/trading/RiskGatedSwapPanel'

type Tab = 'intel' | 'trade'

/**
 * Intelligence terminal with a "Trade" tab — research → trade in one click.
 * The Trade tab opens RiskGatedSwapPanel pre-targeting the terminal's mint.
 */
export function IntelligenceTradeTabs({ mint }: { mint: string }) {
  const [tab, setTab] = useState<Tab>('intel')

  return (
    <div className="relative w-full">
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('intel')}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
            tab === 'intel'
              ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
              : 'border-white/10 bg-slate-950/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="h-4 w-4" aria-hidden />
          Intel
        </button>
        <button
          onClick={() => setTab('trade')}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
            tab === 'trade'
              ? 'border-[#00d4aa]/40 bg-[#00d4aa]/10 text-[#00d4aa]'
              : 'border-white/10 bg-slate-950/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden />
          Trade
        </button>
      </div>

      {tab === 'intel' ? (
        <IntelligencePanel mint={mint} />
      ) : (
        <div className="py-4">
          <RiskGatedSwapPanel defaultToToken={mint} />
        </div>
      )}
    </div>
  )
}
