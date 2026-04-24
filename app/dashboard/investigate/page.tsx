'use client'

import { useState } from 'react'
import { useCompletion } from '@ai-sdk/react'
import { DisclaimerBanner } from '@/components/legal/DisclaimerBanner'

export default function InvestigatePage() {
  const [mint, setMint] = useState('')

  const { completion, complete, isLoading } = useCompletion({
    api: '/api/agent/investigate',
  })

  function startInvestigation() {
    if (!mint) return
    void complete('', { body: { mint } })
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <DisclaimerBanner variant="ai" />

      <h1 className="mb-2 mt-6 text-3xl font-bold text-white">
        AI Investigation Agent
      </h1>
      <p className="mb-6 text-slate-400">
        Paste any Solana mint. The agent autonomously investigates security,
        whales, patterns, and reports findings.
      </p>

      <div className="mb-8 flex gap-2">
        <input
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          placeholder="Solana mint address"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-white"
        />
        <button
          onClick={startInvestigation}
          disabled={isLoading || !mint}
          className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
        >
          {isLoading ? 'Investigating...' : 'Start Investigation'}
        </button>
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-slate-900/60 p-4">
        <div className="mb-2 text-xs font-mono text-cyan-400">investigation-stream</div>
        <div className="whitespace-pre-wrap text-slate-200">{completion || 'No report yet. Start an investigation above.'}</div>
      </div>
    </div>
  )
}
