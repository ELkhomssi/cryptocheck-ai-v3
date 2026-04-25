'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, Radio, ShieldAlert } from 'lucide-react'
import { NeonForensicPanel } from '@/components/Dashboard/forensic-terminal/NeonForensicPanel'
import { SignalBadge } from '../shared/SignalBadge'

type SignalResponse = {
  verdict: string
  summary: string
  confidencePct: number
  observations?: unknown[]
  whaleCount?: number
  disclaimer?: string
}

function humanizeProviderMessage(raw?: string): string {
  if (!raw?.trim()) return 'The intelligence service is reconnecting. Your session stays secure.'
  const t = raw.toLowerCase()
  if (
    t.includes('signal generation failed') ||
    t.includes('signal generation') ||
    t.includes('diagnostic pipeline')
  ) {
    return 'The synthesizer could not complete this pass — often a transient upstream or rate limit. Try again shortly.'
  }
  if (t.includes('unavailable') || t.includes('failed')) {
    return 'Upstream intelligence is temporarily unavailable. This is not a verdict on the asset.'
  }
  if (raw.length > 160) return `${raw.slice(0, 157)}…`
  return raw
}

export function AISignalPanel({ mint }: { mint: string }) {
  const [data, setData] = useState<SignalResponse | null>(null)
  const [error, setError] = useState(false)
  const [diag, setDiag] = useState<{ code?: string; hint?: string; detail?: string; raw?: string }>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    async function run() {
      try {
        setError(false)
        setDiag({})
        setData(null)
        setLoading(true)
        const res = await fetch(`/api/v1/intelligence/signals/${mint}`, { cache: 'no-store' })
        const json = (await res.json()) as SignalResponse & {
          error?: string
          code?: string
          hint?: string
          detail?: string
        }
        if (!active) return
        if (!res.ok) {
          setError(true)
          setDiag({
            code: json.code,
            hint: json.hint,
            detail: json.detail,
            raw: json.error,
          })
          return
        }
        setData(json)
      } catch {
        if (active) {
          setError(true)
          setDiag({ raw: 'Network interruption' })
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    if (mint?.length >= 32) void run()
    else {
      setLoading(false)
      setData(null)
      setError(false)
      setDiag({})
    }
    return () => {
      active = false
    }
  }, [mint])

  const showAwaiting = loading || (!data && !error && mint.length >= 32)
  const showDiagnostic = error

  return (
    <NeonForensicPanel title="AI Signal Panel" badge="Consensus" tone="neutral">
      <AnimatePresence mode="wait">
        {showAwaiting ? (
          <motion.div
            key="awaiting"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex flex-col items-center justify-center gap-5 py-6"
          >
            <div className="relative flex h-24 w-24 items-center justify-center">
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              />
              <motion.span
                className="absolute inset-2 rounded-full border-2 border-fuchsia-400/25 border-t-transparent"
                animate={{ rotate: -360 }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
              />
              <motion.span
                className="absolute inset-5 rounded-full border border-emerald-400/30"
                animate={{ scale: [1, 1.06, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <Radio className="relative z-[1] h-9 w-9 text-cyan-300" aria-hidden />
            </div>
            <div className="text-center">
              <p className="font-space text-lg font-bold tracking-tight text-white">Diagnostic in progress</p>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                Awaiting signal data from the forensic pipeline. Encrypted channel active — no automated trades.
              </p>
            </div>
            <motion.div
              className="flex gap-1.5"
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.2 } },
                hidden: {},
              }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-2 w-2 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400"
                  variants={{
                    hidden: { opacity: 0.3, y: 0 },
                    visible: {
                      opacity: [0.3, 1, 0.3],
                      y: [0, -6, 0],
                      transition: { duration: 0.9, repeat: Infinity, delay: i * 0.15 },
                    },
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        ) : null}

        {showDiagnostic ? (
          <motion.div
            key="diagnostic"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-slate-950/80 to-fuchsia-950/30 p-5 shadow-[0_0_40px_rgba(245,158,11,0.12)]">
              <motion.div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-7 w-7 shrink-0 text-amber-300" aria-hidden />
                <div>
                  <p className="font-space text-lg font-bold text-amber-100">Awaiting authoritative signal</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{humanizeProviderMessage(diag.raw)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-4 font-mono-terminal text-xs text-slate-400">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                <span className="uppercase tracking-wider">Technical reference</span>
              </div>
              {diag.code ? (
                <p className="font-semibold uppercase tracking-wider text-cyan-400/90">code · {diag.code}</p>
              ) : null}
              {diag.hint ? <p className="mt-2 leading-relaxed">{diag.hint}</p> : null}
              {diag.detail ? <p className="mt-2 text-rose-300/80">{diag.detail}</p> : null}
            </div>
          </motion.div>
        ) : null}

        {!showAwaiting && !showDiagnostic && data ? (
          <motion.div
            key="data"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <SignalBadge verdict={data.verdict} />
            <p className="text-base leading-relaxed text-slate-200">{data.summary}</p>
            <div className="grid grid-cols-2 gap-3 font-mono-terminal text-sm text-slate-400">
              <div>
                <span className="text-slate-500">Data quality</span>
                <div className="mt-0.5 font-semibold text-cyan-200/90">{data.confidencePct}%</div>
              </div>
              <div>
                <span className="text-slate-500">Whales observed</span>
                <div className="mt-0.5 font-semibold text-emerald-200/90">{data.whaleCount ?? 0}</div>
              </div>
              <div>
                <span className="text-slate-500">Observations</span>
                <div className="mt-0.5 font-semibold text-fuchsia-200/90">{data.observations?.length ?? 0}</div>
              </div>
              <div>
                <span className="text-slate-500">Mode</span>
                <div className="mt-0.5 font-semibold text-slate-300">Signal-only</div>
              </div>
            </div>
            <p className="text-sm text-amber-200/90">
              {data.disclaimer ?? 'Informational only. Not financial advice. Do your own research.'}
            </p>
          </motion.div>
        ) : null}

        {!showAwaiting && !showDiagnostic && !data && mint.length < 32 ? (
          <p className="py-4 text-center text-sm text-slate-500">Enter a valid mint (32+ characters) to run the signal pipeline.</p>
        ) : null}
      </AnimatePresence>
    </NeonForensicPanel>
  )
}
