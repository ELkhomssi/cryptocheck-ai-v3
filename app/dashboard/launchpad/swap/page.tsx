'use client'

import { useState } from 'react'
import { SignalSwapSheet } from '@/components/signals-dashboard/SignalSwapSheet'
import { namespacedSignalId, type UnifiedSignal } from '@cryptocheck/signal-contracts'
import { LAUNCHPAD_FEE_NOTE } from '@/lib/launchpad/constants'

export default function LaunchpadSwapPage() {
  const [mint, setMint] = useState('')
  const [active, setActive] = useState<UnifiedSignal | null>(null)

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-rd-display text-lg font-bold uppercase tracking-wide text-rd-hi">
          Risk-gated swap
        </h2>
        <p className="mt-1 text-sm text-rd-mid">
          Confirm sheet always shows Platform fee, slippage, and price impact. {LAUNCHPAD_FEE_NOTE}
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={mint}
          onChange={(e) => setMint(e.target.value.trim())}
          placeholder="Paste mint…"
          className="font-rd-mono flex-1 rounded-rd-sm border border-white/15 bg-rd-navy px-3 py-2 text-xs text-rd-hi"
        />
        <button
          type="button"
          disabled={mint.length < 32}
          onClick={() => {
            const now = new Date().toISOString()
            setActive({
              id: namespacedSignalId('launchpad', `swap:${mint}`),
              sourceTag: 'launchpad',
              sourceRef: `swap:${mint}`,
              subjectType: 'token',
              label: mint.slice(0, 6),
              type: 'mention',
              msgTimestamp: now,
              ingestTimestamp: now,
              confidence: 1,
              chain: 'solana',
              contractAddress: mint,
              verdict: 'scanning',
              rawPayload: {},
              sources: ['launchpad'],
              sourceCount: 1,
            })
          }}
          className="rounded-rd-sm bg-rd-green px-4 py-2 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider text-rd-navy disabled:opacity-40"
        >
          Load swap
        </button>
      </div>

      {active ? (
        <SignalSwapSheet signal={active} open onClose={() => setActive(null)} variant="inline" />
      ) : (
        <p className="rounded-rd-sm border border-dashed border-white/15 px-4 py-8 text-center text-sm text-rd-mid">
          Enter a mint to open the risk-gated confirm sheet.
        </p>
      )}
    </div>
  )
}
