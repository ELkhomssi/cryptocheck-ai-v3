'use client'

import { useEffect, useState } from 'react'

export type SecurityTerminalVariant = 'scan' | 'stress'

const SCAN_SCRIPT: { text: string; suffix?: string }[] = [
  { text: '[*] Initializing Neural Breach Engine...' },
  { text: '[*] Mapping Attack Surface (SPL + metadata)...' },
  { text: '[*] Applying Zero-Day Heuristics to RPC plane...' },
  { text: '[*] Testing Ownership Logic... ', suffix: '[SECURE]' },
  { text: '[*] Probing Liquidity Lock & pool routing... ', suffix: '[SCANNING]' },
  { text: '[*] Protocol Integrity checksum... ', suffix: '[PASS]' },
  { text: '[*] Malicious Payload Detection layer... ', suffix: '[ACTIVE]' },
  { text: '[*] Compiling Neural verdict envelope...' },
]

const STRESS_SCRIPT: { text: string; suffix?: string }[] = [
  { text: '[*] Arming Offensive Sovereign sandbox...' },
  { text: '[*] Cloning account layout — isolated fork...' },
  { text: '[*] [Vector: Liquidity Siphoning] red-team probe... ', suffix: '[RUNNING]' },
  { text: '[*] [Vector: Authority Escalation] CPI trace... ', suffix: '[RUNNING]' },
  { text: '[*] [Vector: Social / Rug Intent] holder graph... ', suffix: '[RUNNING]' },
  { text: '[*] Aggregating Multi-Vector Attack Simulation...' },
  { text: '[*] Sealing classified brief... ', suffix: '[DONE]' },
]

// Slower per-character cadence keeps the typewriter readable without scheduling
// a re-render every animation frame. The stress-test UI sits above the heavy
// dashboard tree, and sub-15ms intervals were starving the main thread.
function typewriterMs(len: number): number {
  return Math.min(60, 22 + Math.floor(len / 6))
}

export default function SecurityTerminal({
  active,
  variant = 'scan',
  className = '',
}: {
  active: boolean
  variant?: SecurityTerminalVariant
  className?: string
}) {
  const [lineIdx, setLineIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)

  useEffect(() => {
    if (!active) {
      setLineIdx(0)
      setCharIdx(0)
      return
    }
    const lines = variant === 'stress' ? STRESS_SCRIPT : SCAN_SCRIPT
    const line = lines[lineIdx]
    if (!line) return
    const full = line.text + (line.suffix ?? '')
    if (charIdx < full.length) {
      const t = setTimeout(() => setCharIdx((c) => c + 1), typewriterMs(full.length))
      return () => clearTimeout(t)
    }
    if (lineIdx < lines.length - 1) {
      const t = setTimeout(() => {
        setLineIdx((i) => i + 1)
        setCharIdx(0)
      }, 120)
      return () => clearTimeout(t)
    }
    return undefined
  }, [active, lineIdx, charIdx, variant])

  if (!active) return null

  const script = variant === 'stress' ? STRESS_SCRIPT : SCAN_SCRIPT

  return (
    <div
      className={`w-full max-w-lg rounded-lg border border-white/[0.08] bg-[#050508]/90 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-[#0a0a0f]/80">
        <span className="h-2 w-2 rounded-full bg-[#c8ff00] shadow-[0_0_10px_#c8ff00]" />
        <span className="text-[0.55rem] font-mono font-bold tracking-[0.2em] text-[#94a3b8] uppercase">
          Simulation Terminal
        </span>
        <span className="ml-auto text-[0.5rem] font-mono text-[#c8ff00]/80">LIVE</span>
      </div>
      <div className="p-3 font-mono text-[0.62rem] leading-relaxed text-[#b8c5d4] min-h-[168px] space-y-1">
        {script.slice(0, lineIdx + 1).map((row, i) => {
          const isLast = i === lineIdx
          const full = row.text + (row.suffix ?? '')
          const shown = isLast ? full.slice(0, charIdx) : full
          const base = row.text.length
          const suffixPart = shown.length > base ? shown.slice(base) : ''
          const mainPart = shown.slice(0, Math.min(shown.length, base))
          const suffixColor =
            row.suffix?.includes('VULN') || row.suffix?.includes('FAIL')
              ? 'text-[#ff5722]'
              : row.suffix === '[SCANNING]' || row.suffix === '[RUNNING]'
                ? 'text-amber-400'
                : 'text-[#c8ff00]'
          return (
            <div key={i} className="whitespace-pre-wrap break-words">
              <span className="text-[#6b7a90]">{mainPart}</span>
              {suffixPart ? <span className={suffixColor}>{suffixPart}</span> : null}
              {isLast && charIdx < full.length && (
                <span className="inline-block w-1.5 h-3 ml-0.5 bg-[#c8ff00]/90 align-middle animate-pulse" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
