'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Check, Sparkles, X, Zap } from 'lucide-react'
import type { ReactNode } from 'react'

export function TerminalMesh() {
  return (
    <motion.div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="web4-mesh absolute inset-0" />
      <div className="web4-grid-overlay absolute inset-0 opacity-60" />
      <div
        className="absolute -left-32 top-20 h-64 w-64 rounded-full bg-[#22c55e]/10 blur-[100px]"
        style={{ animation: 'web4-float 8s ease-in-out infinite' }}
      />
      <div
        className="absolute -right-24 bottom-32 h-48 w-48 rounded-full bg-cyan-500/8 blur-[80px]"
        style={{ animation: 'web4-float 10s ease-in-out infinite 1s' }}
      />
    </motion.div>
  )
}

export function LivePulse({ label = 'LIVE' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#22c55e]/30 bg-[#22c55e]/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-[#86efac]">
      <span className="relative flex h-1.5 w-1.5">
        <span
          className="absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-60"
          style={{ animation: 'web4-pulse-ring 1.5s ease-in-out infinite' }}
        />
        <span className="relative h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
      </span>
      {label}
    </span>
  )
}

export function GlassCard({
  children,
  className = '',
  glow = false,
}: {
  children: ReactNode
  className?: string
  glow?: boolean
}) {
  return (
    <div className={`web4-glass rounded-2xl ${glow ? 'web4-glow-green' : ''} ${className}`}>
      {children}
    </div>
  )
}

export type ToastItem = {
  id: string
  kind: 'buy' | 'sell' | 'deploy' | 'grad' | 'info'
  title: string
  sub?: string
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-[110] flex flex-col gap-2 md:bottom-6">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 24, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.95 }}
            className="pointer-events-auto flex max-w-[320px] items-start gap-3 rounded-xl border border-white/10 bg-[#0c0c0c]/95 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          >
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                t.kind === 'buy'
                  ? 'bg-[#22c55e]/20 text-[#86efac]'
                  : t.kind === 'sell'
                    ? 'bg-red-500/20 text-red-400'
                    : t.kind === 'grad'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-white/10 text-white'
              }`}
            >
              {t.kind === 'buy' || t.kind === 'sell' ? (
                <Zap className="h-4 w-4" />
              ) : t.kind === 'grad' ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{t.title}</p>
              {t.sub ? <p className="mt-0.5 text-xs text-white/50">{t.sub}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 text-white/30 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function MarqueeTicker({
  items,
}: {
  items: { key: string; node: ReactNode }[]
}) {
  const doubled = [...items, ...items]
  return (
    <div className="relative overflow-hidden border-b border-white/[0.06] bg-black/40 py-2">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#050505] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#050505] to-transparent" />
      <div className="web4-marquee-track flex w-max gap-8 px-4">
        {doubled.map((item, i) => (
          <div key={`${item.key}-${i}`} className="shrink-0">
            {item.node}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DiscoverHero({ onCreate }: { onCreate: () => void }) {
  return (
    <GlassCard glow className="relative overflow-hidden p-6 md:p-8">
      <div className="web4-shimmer-border absolute inset-x-0 top-0 h-px" />
      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <LivePulse />
            <span className="text-[0.65rem] text-white/40">Bonding curve · 85 SOL graduation</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Launch memecoins in{' '}
            <span className="bg-gradient-to-r from-[#86efac] via-[#4ade80] to-[#22c55e] bg-clip-text text-transparent">
              seconds
            </span>
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/50">
            CryptoCheck-safe curves, Padre-grade terminal, Pump-speed discovery. Create, ape, graduate to
            Raydium.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="web4-btn-primary shrink-0 rounded-2xl px-8 py-4 text-sm font-bold text-black"
        >
          + Create your coin
        </button>
      </div>
    </GlassCard>
  )
}

export function LoadingTerminal() {
  return (
    <div className="relative flex min-h-[70vh] flex-col items-center justify-center">
      <TerminalMesh />
      <motion.div
        className="relative z-10 flex flex-col items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="relative h-14 w-14">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-[#22c55e]/30"
            style={{ animation: 'web4-pulse-ring 1.2s ease-in-out infinite' }}
          />
          <div className="absolute inset-2 rounded-full border-2 border-t-[#86efac] border-[#22c55e]/20 animate-spin" />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/40">
          Syncing bonding engine
        </p>
      </motion.div>
    </div>
  )
}
