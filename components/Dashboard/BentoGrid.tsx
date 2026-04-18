'use client'

import ReactMarkdown from 'react-markdown'
import { memo, useMemo } from 'react'
import SecurityTerminal from '@/components/SecurityTerminal'

export type StressPhase = 'idle' | 'analyzing' | 'simulating'

export interface MultiVectorApi {
  liquiditySiphoning: { result: 'Pass' | 'Fail'; logic: string }
  authorityEscalation: { result: 'Pass' | 'Fail'; logic: string }
  socialEngineeringRugIntent: { behavioralAnalysis: string }
}

export interface StressTestApiResult {
  address: string
  kind: string
  riskScore: number
  safetyScore?: number
  eliteTier?: string
  eliteLabel?: string
  certificationLine?: string
  ironDomeCertified?: boolean
  sandboxRiskScore: number
  technicalVulnerabilitiesMarkdown: string
  marketMaliceMarkdown: string
  fullReportMarkdown: string
  multiVectorSimulation?: MultiVectorApi
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

// GPT-4o occasionally wraps string fields into objects like { text: "..." },
// { message: "..." }, or { content: "..." } despite the prompt requesting a raw
// string. Rendering that object directly yields "[object Object]" in the UI.
// This helper unwraps the common shapes and guarantees a string.
function toDisplayText(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (typeof content === 'number' || typeof content === 'boolean') return String(content)
  if (Array.isArray(content)) return content.map(toDisplayText).filter(Boolean).join('\n')
  if (typeof content === 'object') {
    const obj = content as Record<string, unknown>
    const candidate = obj.text ?? obj.message ?? obj.content ?? obj.value ?? obj.markdown
    if (typeof candidate === 'string') return candidate
    if (candidate != null) return toDisplayText(candidate)
    try {
      return JSON.stringify(content)
    } catch {
      return ''
    }
  }
  return String(content)
}

/**
 * The stress-test report modal renders large Markdown bodies. ReactMarkdown re-parses
 * its children on every render, so we isolate it behind React.memo and pre-compute the
 * string with useMemo. This keeps unrelated dashboard state changes (clock ticks, live
 * feed polls, etc.) from thrashing the markdown AST while the modal is mounted.
 */
const MarkdownBlock = memo(function MarkdownBlock({ content }: { content: string }) {
  return (
    <div className={mdClass}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
})

interface StressReportModalProps {
  stressResult: StressTestApiResult
  onCloseReport: () => void
}

const StressReportModal = memo(function StressReportModal({
  stressResult,
  onCloseReport,
}: StressReportModalProps) {
  const technicalBody = useMemo(
    () => toDisplayText(stressResult.technicalVulnerabilitiesMarkdown),
    [stressResult.technicalVulnerabilitiesMarkdown]
  )
  const marketBody = useMemo(
    () => toDisplayText(stressResult.marketMaliceMarkdown),
    [stressResult.marketMaliceMarkdown]
  )
  const liqLogic = useMemo(
    () =>
      stressResult.multiVectorSimulation
        ? toDisplayText(stressResult.multiVectorSimulation.liquiditySiphoning.logic)
        : '',
    [stressResult.multiVectorSimulation]
  )
  const authLogic = useMemo(
    () =>
      stressResult.multiVectorSimulation
        ? toDisplayText(stressResult.multiVectorSimulation.authorityEscalation.logic)
        : '',
    [stressResult.multiVectorSimulation]
  )
  const socLogic = useMemo(
    () =>
      stressResult.multiVectorSimulation
        ? toDisplayText(
            stressResult.multiVectorSimulation.socialEngineeringRugIntent.behavioralAnalysis
          )
        : '',
    [stressResult.multiVectorSimulation]
  )
  const simNotes = useMemo(
    () => (stressResult.simulationNotes ? toDisplayText(stressResult.simulationNotes) : ''),
    [stressResult.simulationNotes]
  )

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border border-[rgba(139,92,246,0.35)] bg-[#07060f] shadow-[0_0_40px_rgba(88,28,135,0.35)] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#050508]/95">
          <div>
            <div className="text-[0.55rem] font-mono text-[#c8ff00] tracking-wider uppercase">
              Sovereign Brief — Multi-Vector Simulation
            </div>
            <div className="text-sm font-bold text-[#e8eaed] mt-0.5 font-mono">
              {stressResult.eliteTier ? (
                <>
                  Tier{' '}
                  <span
                    className={
                      stressResult.eliteTier === 'S' || stressResult.eliteTier === 'A'
                        ? 'text-[#c8ff00]'
                        : stressResult.eliteTier === 'F' || stressResult.eliteTier === 'D'
                          ? 'text-[#ff5722]'
                          : 'text-amber-400'
                    }
                  >
                    {stressResult.eliteTier}
                  </span>
                  {stressResult.eliteLabel ? ` · ${stressResult.eliteLabel}` : ''}
                </>
              ) : null}
              <span className="text-[#8b949e] font-normal">
                {' '}
                · Risk {stressResult.riskScore}/100 · {stressResult.kind}
              </span>
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#030308]">
          {stressResult.multiVectorSimulation && (
            <section className="rounded-lg border border-[#c8ff00]/20 bg-white/[0.03] backdrop-blur-md p-3 space-y-2">
              <div className="text-[0.55rem] font-bold text-[#c8ff00] font-mono tracking-wider uppercase">
                Multi-Vector Attack Simulation
              </div>
              <div className="text-[0.6rem] font-mono text-[#b8c5d4] space-y-1.5">
                <p>
                  <span className="text-[#8b949e]">[Vector: Liquidity Siphoning]</span>{' '}
                  <span
                    className={
                      stressResult.multiVectorSimulation.liquiditySiphoning.result === 'Fail'
                        ? 'text-[#ff5722]'
                        : 'text-[#c8ff00]'
                    }
                  >
                    {stressResult.multiVectorSimulation.liquiditySiphoning.result}
                  </span>
                  <span className="text-[#6b7a90]"> — </span>
                  {liqLogic}
                </p>
                <p>
                  <span className="text-[#8b949e]">[Vector: Authority Escalation]</span>{' '}
                  <span
                    className={
                      stressResult.multiVectorSimulation.authorityEscalation.result === 'Fail'
                        ? 'text-[#ff5722]'
                        : 'text-[#c8ff00]'
                    }
                  >
                    {stressResult.multiVectorSimulation.authorityEscalation.result}
                  </span>
                  <span className="text-[#6b7a90]"> — </span>
                  {authLogic}
                </p>
                <p>
                  <span className="text-[#8b949e]">[Vector: Social Engineering / Rug Intent]</span>{' '}
                  {socLogic}
                </p>
              </div>
            </section>
          )}
          <section className="rounded-lg border border-[rgba(59,130,246,0.2)] bg-[#0c0c18] p-3">
            <div className="text-[0.55rem] font-bold text-[#60a5fa] font-mono mb-2 tracking-wider">TECHNICAL VULNERABILITIES</div>
            <MarkdownBlock content={technicalBody} />
          </section>
          <section className="rounded-lg border border-[rgba(244,63,94,0.25)] bg-[rgba(24,10,20,0.5)] p-3">
            <div className="text-[0.55rem] font-bold text-[#fb7185] font-mono mb-2 tracking-wider">MARKET MALICE (HONEYPOT / RUG)</div>
            <MarkdownBlock content={marketBody} />
          </section>
          {simNotes && (
            <div className="text-[0.6rem] text-[#8b949e] font-mono border-t border-white/5 pt-3">
              <span className="text-[#a78bfa]">Simulation: </span>
              {simNotes}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

function BentoGridImpl({
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
      <div className="px-3 md:px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-[#030308] via-[#050510] to-[#020204] backdrop-blur-md">
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
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-[0.58rem] text-[#c8ff00] font-mono">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#c8ff00] animate-pulse shadow-[0_0_8px_#c8ff00]" />
              {phaseLabel}
            </div>
            <SecurityTerminal active variant="stress" />
          </div>
        )}
        {stressError && <div className="mt-2 text-[0.58rem] text-red-400 font-mono">{stressError}</div>}
      </div>

      {reportOpen && stressResult && (
        <StressReportModal stressResult={stressResult} onCloseReport={onCloseReport} />
      )}
    </>
  )
}

/**
 * The surrounding dashboard has a lot of unrelated state (live feed, slot clock,
 * portfolio polling). Without `memo`, every tick of those timers re-rendered the
 * heavy stress-test UI (SecurityTerminal typewriter + ReactMarkdown bodies). The
 * memo wrapper only re-renders when BentoGrid's own props actually change.
 */
const BentoGrid = memo(BentoGridImpl)
export default BentoGrid
