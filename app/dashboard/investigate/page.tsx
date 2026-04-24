'use client'

import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { DisclaimerBanner } from '@/components/legal/DisclaimerBanner'

type ToolState = 'running' | 'result'
type ToolEvent = { type: 'tool'; toolName: string; state: ToolState; detail: string }
type TextEvent = { type: 'text'; content: string }
type DoneEvent = { type: 'done' }
type StreamEvent = ToolEvent | TextEvent | DoneEvent

const TOOL_META: Record<string, { icon: string; label: string }> = {
  scanTokenSecurity: { icon: '🛡', label: 'Sentinel Security Scan' },
  fetchWhaleFlow: { icon: '🐋', label: 'Whale Flow Trace' },
  queryRelationshipGraph: { icon: '🕸', label: 'Relationship Graph' },
  checkWalletAge: { icon: '👤', label: 'Wallet Age Check' },
  matchHistoricalPatterns: { icon: '📚', label: 'Historical Pattern Match' },
  checkLiquidityLock: { icon: '🔒', label: 'Liquidity Lock Audit' },
  synthesizeReport: { icon: '📝', label: 'Forensic Synthesis' },
}

export default function InvestigatePage() {
  const [mint, setMint] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState('')
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([])
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [toolStartedAt, setToolStartedAt] = useState<Record<string, number>>({})
  const [elapsedNow, setElapsedNow] = useState(Date.now())

  async function startInvestigation() {
    if (!mint) return
    setLoading(true)
    setReport('')
    setToolEvents([])
    setRunStartedAt(Date.now())
    setToolStartedAt({})

    try {
      const res = await fetch('/api/agent/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint }),
      })
      if (!res.ok || !res.body) {
        const msg = await res.text()
        throw new Error(msg || 'Unable to start investigation')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          const evt = JSON.parse(line) as StreamEvent
          if (evt.type === 'tool') {
            setToolEvents((prev) => [...prev, evt])
            if (evt.state === 'running') {
              setToolStartedAt((prev) => ({
                ...prev,
                [evt.toolName]: prev[evt.toolName] ?? Date.now(),
              }))
            }
          } else if (evt.type === 'text') {
            setReport(evt.content)
          }
        }
      }
    } catch (error) {
      setReport(error instanceof Error ? error.message : 'Investigation failed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedNow(Date.now())
    }, 250)
    return () => window.clearInterval(interval)
  }, [])

  const latestByTool = useMemo(() => {
    const map = new Map<string, ToolEvent>()
    for (const event of toolEvents) map.set(event.toolName, event)
    return Array.from(map.entries()).map(([toolName, event]) => ({ toolName, event }))
  }, [toolEvents])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] p-6 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.14),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.15),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(16,185,129,0.12),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#22d3ee_1px,transparent_1px),linear-gradient(to_bottom,#22d3ee_1px,transparent_1px)] [background-size:52px_52px]" />

      <style jsx>{`
        @keyframes pulseGlow {
          0%,
          100% {
            box-shadow: 0 0 0 rgba(34, 211, 238, 0.2);
          }
          50% {
            box-shadow: 0 0 24px rgba(34, 211, 238, 0.45);
          }
        }
        .cyber-glow {
          animation: pulseGlow 2.4s ease-in-out infinite;
        }
        @keyframes scanlineSweep {
          0% {
            transform: translateY(-120%);
            opacity: 0;
          }
          20% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(120%);
            opacity: 0;
          }
        }
        .scanline-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .scanline-overlay::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          height: 120px;
          background: linear-gradient(
            to bottom,
            rgba(34, 211, 238, 0),
            rgba(34, 211, 238, 0.18),
            rgba(34, 211, 238, 0)
          );
          animation: scanlineSweep 4.5s linear infinite;
        }
        @keyframes particleFloat {
          0% {
            transform: translate3d(0, 0, 0);
            opacity: 0;
          }
          10% {
            opacity: 0.55;
          }
          100% {
            transform: translate3d(var(--x-shift), -75vh, 0);
            opacity: 0;
          }
        }
        .particle {
          position: absolute;
          bottom: -10px;
          width: 3px;
          height: 3px;
          border-radius: 999px;
          background: rgba(34, 211, 238, 0.8);
          box-shadow: 0 0 10px rgba(34, 211, 238, 0.8);
          animation: particleFloat var(--duration) linear infinite;
          animation-delay: var(--delay);
          left: var(--left);
          --x-shift: var(--drift);
        }
      `}</style>

      <div className="relative mx-auto max-w-6xl">
        <div className="scanline-overlay" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 22 }).map((_, i) => (
            <span
              key={`particle-${i}`}
              className="particle"
              style={
                {
                  '--left': `${(i * 97) % 100}%`,
                  '--duration': `${8 + (i % 7)}s`,
                  '--delay': `${-1 * (i % 11)}s`,
                  '--drift': `${(i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 6)}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>

      <DisclaimerBanner variant="ai" />

        <h1 className="mb-2 mt-6 bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-emerald-300 bg-clip-text text-4xl font-bold text-transparent">
          AI Investigation Agent
        </h1>
        <p className="mb-6 max-w-3xl text-slate-300">
          Autonomous forensic workflow for Solana mints: risk scan, whale behavior, relationship mapping, liquidity integrity, then a structured intelligence report.
        </p>

        <div className="mb-8 grid gap-3 rounded-2xl border border-cyan-400/20 bg-black/40 p-4 backdrop-blur-xl md:grid-cols-[1fr_auto]">
          <input
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            placeholder="Paste Solana mint address"
            className="rounded-xl border border-cyan-400/25 bg-slate-950/90 px-4 py-3 font-mono text-sm text-cyan-100 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30"
          />
          <button
            onClick={() => void startInvestigation()}
            disabled={loading || !mint}
            className="cyber-glow rounded-xl border border-cyan-300/40 bg-gradient-to-r from-cyan-400 to-emerald-400 px-6 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Investigating...' : 'Start Investigation'}
          </button>
        </div>
        <p className="mb-6 text-xs font-mono uppercase tracking-[0.18em] text-cyan-300/80">
          Session Runtime:{' '}
          <span className="text-emerald-300">
            {runStartedAt ? `${((elapsedNow - runStartedAt) / 1000).toFixed(1)}s` : 'idle'}
          </span>
        </p>

        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <section className="rounded-2xl border border-cyan-500/20 bg-black/40 p-4 backdrop-blur-xl">
            <div className="mb-3 text-xs font-mono uppercase tracking-[0.2em] text-cyan-300">Tool Call Visualization</div>
            <div className="space-y-2">
              {latestByTool.length === 0 && (
                <p className="text-sm text-slate-400">No tool calls yet. Run an investigation to stream execution steps.</p>
              )}
              {latestByTool.map(({ toolName, event }) => {
                const meta = TOOL_META[toolName] ?? { icon: '🔍', label: toolName }
                const isDone = event.state === 'result'
                return (
                  <div
                    key={toolName}
                    className={`rounded-lg border px-3 py-2 ${isDone ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-cyan-400/30 bg-cyan-500/10'}`}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span>{meta.icon}</span>
                      <span className="font-medium text-slate-100">{meta.label}</span>
                      <span className={`ml-auto text-[11px] uppercase ${isDone ? 'text-emerald-300' : 'text-cyan-300'}`}>
                        {isDone ? 'Complete' : 'Running'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{event.detail}</p>
                    <p className="mt-1 text-[11px] font-mono text-slate-400">
                      elapsed:{' '}
                      {toolStartedAt[toolName]
                        ? `${((elapsedNow - toolStartedAt[toolName]) / 1000).toFixed(1)}s`
                        : '0.0s'}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-fuchsia-500/20 bg-black/40 p-4 backdrop-blur-xl">
            <div className="mb-3 text-xs font-mono uppercase tracking-[0.2em] text-fuchsia-300">Forensic Report</div>
            <div className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-slate-950/70 p-4 text-sm leading-relaxed text-slate-200">
              {report || 'Awaiting investigation output...'}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
