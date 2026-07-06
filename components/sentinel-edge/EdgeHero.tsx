'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Decision } from '@cryptocheck/signal-contracts'

type Props = {
  decision: Decision | null
  onDismiss: () => void
  onVerify: () => void
}

export function EdgeHero({ decision, onDismiss, onVerify }: Props) {
  const reduce = useReducedMotion()

  return (
    <AnimatePresence>
      {decision ? (
        <motion.div
          key={decision.id}
          role="status"
          aria-live="polite"
          initial={reduce ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.28 }}
          className="rd-panel relative overflow-hidden border-rd-green/40 bg-gradient-to-r from-rd-green/10 via-rd-navy2/90 to-rd-navy2 px-4 py-3 shadow-[0_0_40px_rgba(63,224,90,0.12)]"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40 motion-safe:animate-pulse"
            style={{
              background:
                'radial-gradient(ellipse 60% 80% at 0% 50%, rgba(63,224,90,0.2), transparent)',
            }}
            aria-hidden
          />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-rd-display text-[0.58rem] font-bold uppercase tracking-[0.2em] text-rd-lime">
                Edge detected
              </p>
              <p className="mt-1 font-rd-display text-base font-bold uppercase tracking-wide text-rd-hi">
                {decision.label ?? decision.matchId}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-rd-mid">
                {decision.edgeSignal.rationale}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-rd-display text-[0.5rem] font-bold uppercase tracking-wider text-amber-200">
                  {decision.side} · {decision.size}
                </span>
                <span className="rounded border border-rd-green/40 bg-rd-green/10 px-2 py-0.5 font-rd-mono text-[0.6rem] tabular-nums text-rd-green">
                  edge {decision.edgeSignal.magnitude}
                </span>
                <span className="rounded border border-white/15 px-2 py-0.5 font-rd-display text-[0.5rem] font-bold uppercase tracking-wider text-rd-mid">
                  On-chain proof
                </span>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onVerify}
                className="rounded-rd-sm bg-rd-green px-3 py-2 font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-rd-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/60"
              >
                Verify
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-rd-sm border border-white/15 px-3 py-2 font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-rd-mid hover:text-rd-hi focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/40"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
