'use client'

import ReactMarkdown from 'react-markdown'
import { useMemo } from 'react'

export type StressPhase = 'idle' | 'analyzing' | 'simulating'

export interface StressTestApiResult {
  address: string
  kind: string
  riskScore: number
  sandboxRiskScore: number
  technicalVulnerabilitiesMarkdown: string
  marketMaliceMarkdown: string
  fullReportMarkdown: string
  simulationNotes?: string
  phases?: string[]
}

interface BentoGridProps {
  address: string | null | undefined
  onRunStressTest: () => void
  stressLoading: boolean
  stressPhase: StressPhase
  stressError: string
  stressResult: StressTestApiResult | null
  reportOpen: boolean
  onCloseReport: () => void
}

const mdClass =
  'text-[0.68rem] leading-relaxed text-[#c9d1d9] [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-[#e9d5ff] [&_h1]:mb-2 [&_h2]:text-[0.75rem] [&_h2]:font-bold [&_h2]:text-[#a78bfa] [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-[0.7rem] [&_h3]:font-semibold [&_h3]:text-[#c4b5fd] [&_p]:mb-2 [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-[#e9d5ff] [&_code]:text-[#34d399] [&_code]:text-[0.62rem]'

export default function BentoGrid({
  address,
  onRunStressTest,
  stressLoading,
  stressPhase,
  stressError,
  stressResult,
  reportOpen,
  onCloseReport,
}: BentoGridProps) {
  const shortAddr = useMemo(() => {
    if (!address || address.length < 12) return '—'
    return `${address.slice(0, 6)}…${address.slice(-4)}`
  }, [address])

  const phaseLabel =
    stressPhase === 'analyzing' ? 'Analyzing Logic Patterns…' : stressPhase === 'simulating' ? 'Simulating AI Attacks…' : ''

  return (
    <>
      <div className="px-3 md:px-4 py-3 border-b border-[rgba(139,92,246,0.2)] bg-gradient-to-r from-[#0a0518] via-[#0c0c18] to-[#050510]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[0.58rem] font-bold tracking-[0.12em] text-[#a78bfa] font-mono uppercase">Proactive Defense</div>
          <span className="text-[0.5rem] text-[#6b7280] font-mono">{shortAddr}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-lg border border-[rgba(139,92,246,0.25)] bg-[rgba(88,28,135,0.12)] p-2.5 min-h-[88px] flex flex-col justify-between">
            <div className="text-[0.55rem] text-[#9ca3af] font-mono">Neural Scan</div>
            <div className="text-[0.62rem] text-[#e2e8f0] font-semibold">Token intel</div>
            <div className="text-[0.5rem] text-[#6b7280]">Helius + risk engine</div>
          </div>
          <div className="rounded-lg border border-[rgba(139,92,246,0.35)] bg-[rgba(76,29,149,0.2)] p-2.5 min-h-[88px] flex flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-transparent pointer-events-none" />
            <div className="text-[0.55rem] text-[#c4b5fd] font-mono font-bold relative">AI Stress Test</div>
            <div className="text-[0.62rem] text-[#f5f3ff] font-semibold relative">Simulated exploit</div>
            <button
              type="button"
              onClick={onRunStressTest}
              disabled={stressLoading || !address || address.length < 32}
              className="relative mt-1 w-full rounded-md py-1.5 text-[0.58rem] font-bold font-mono tracking-wide
                bg-gradient-to-r from-violet-600 to-fuchsia-700 text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]
                disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all border border-violet-500/40"
            >
              {stressLoading ? '⟳ Running…' : 'Run AI Stress Test'}
            </button>
          </div>
          <div className="rounded-lg border border-[rgba(139,92,246,0.2)] bg-[rgba(15,23,42,0.6)] p-2.5 min-h-[88px] flex flex-col justify-between hidden md:flex">
            <div className="text-[0.55rem] text-[#9ca3af] font-mono">Bytecode / IDL</div>
            <div className="text-[0.62rem] text-[#e2e8f0] font-semibold">Helius + Solscan</div>
            <div className="text-[0.5rem] text-[#6b7280]">Auto-fetched context</div>
          </div>
          <div className="rounded-lg border border-[rgba(139,92,246,0.2)] bg-[rgba(15,23,42,0.6)] p-2.5 min-h-[88px] flex flex-col justify-between hidden md:flex">
            <div className="text-[0.55rem] text-[#9ca3af] font-mono">SCONE-bench</div>
            <div className="text-[0.62rem] text-[#e2e8f0] font-semibold">Autonomous threats</div>
            <div className="text-[0.5rem] text-[#6b7280]">Pre-emptive analysis</div>
          </div>
        </div>
        {stressLoading && (
          <div className="mt-2 flex items-center gap-2 text-[0.58rem] text-[#c4b5fd] font-mono">
            <span className="inline-flex h-2 w-2 rounded-full bg-violet-400 animate-pulse shadow-[0_0_8px_#a78bfa]" />
            {phaseLabel}
          </div>
        )}
        {stressError && <div className="mt-2 text-[0.58rem] text-red-400 font-mono">{stressError}</div>}
      </div>

      {reportOpen && stressResult && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div
            className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border border-[rgba(139,92,246,0.35)] bg-[#07060f] shadow-[0_0_40px_rgba(88,28,135,0.35)] flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(139,92,246,0.2)] bg-gradient-to-r from-violet-950/50 to-fuchsia-950/30">
              <div>
                <div className="text-[0.55rem] font-mono text-[#a78bfa] tracking-wider uppercase">Neural Engine — Stress Report</div>
                <div className="text-sm font-bold text-[#f5f3ff] mt-0.5">
                  Risk {stressResult.riskScore}/100 · {stressResult.kind}
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseReport}
                className="rounded-md px-3 py-1.5 text-[0.62rem] font-mono text-[#c4b5fd] border border-violet-500/40 hover:bg-violet-950/50"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <section className="rounded-lg border border-[rgba(59,130,246,0.2)] bg-[#0c0c18] p-3">
                <div className="text-[0.55rem] font-bold text-[#60a5fa] font-mono mb-2 tracking-wider">TECHNICAL VULNERABILITIES</div>
                <div className={mdClass}>
                  <ReactMarkdown>{stressResult.technicalVulnerabilitiesMarkdown}</ReactMarkdown>
                </div>
              </section>
              <section className="rounded-lg border border-[rgba(244,63,94,0.25)] bg-[rgba(24,10,20,0.5)] p-3">
                <div className="text-[0.55rem] font-bold text-[#fb7185] font-mono mb-2 tracking-wider">MARKET MALICE (HONEYPOT / RUG)</div>
                <div className={mdClass}>
                  <ReactMarkdown>{stressResult.marketMaliceMarkdown}</ReactMarkdown>
                </div>
              </section>
              {stressResult.simulationNotes && (
                <div className="text-[0.6rem] text-[#8b949e] font-mono border-t border-white/5 pt-3">
                  <span className="text-[#a78bfa]">Simulation: </span>
                  {stressResult.simulationNotes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
