'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

/** Flat panel — Pump.fun style */
export function Panel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`web4-panel ${className}`}>{children}</div>
}

/** @deprecated use Panel */
export const GlassCard = Panel

export type ToastItem = {
  id: string
  kind: 'buy' | 'sell' | 'deploy' | 'grad' | 'info'
  title: string
  sub?: string
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <motion.div className="pointer-events-none fixed bottom-4 right-4 z-[110] flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto max-w-[300px] rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2.5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-white">{t.title}</p>
                {t.sub ? <p className="mt-0.5 text-xs text-[#888]">{t.sub}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className="text-[#666] hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

export function MarqueeTicker({ items }: { items: { key: string; node: ReactNode }[] }) {
  const doubled = [...items, ...items]
  return (
    <div className="overflow-hidden border-b border-[#2a2a2a] bg-[#111] py-2">
      <div className="web4-marquee-track flex w-max gap-6 px-4">
        {doubled.map((item, i) => (
          <div key={`${item.key}-${i}`} className="shrink-0">
            {item.node}
          </div>
        ))}
      </div>
    </div>
  )
}

export function LoadingTerminal() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#111]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#86efac]" />
    </div>
  )
}
