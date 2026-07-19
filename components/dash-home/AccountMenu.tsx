'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Code2, CreditCard, KeyRound } from 'lucide-react'

export type AccountMenuProps = {
  name: string
  tier: string
  /** Compact footer style for trading chrome sidebars */
  variant?: 'chip' | 'sidebar'
}

/**
 * Subtle account control — Billing + API Keys live here so primary Trade nav stays clean.
 */
export function AccountMenu({ name, tier, variant = 'chip' }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const initial = (name || 'G').slice(0, 1).toUpperCase()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const triggerClass =
    variant === 'sidebar'
      ? 'flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left font-mono text-sm text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200'
      : 'flex items-center gap-2 rounded-dash-pill border border-dash-innerline bg-dash-panel2 px-3 py-1.5 transition-colors duration-150 hover:border-dash-green/35'

  return (
    <div ref={rootRef} className={`relative ${variant === 'sidebar' ? 'w-full' : ''}`}>
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={
            variant === 'sidebar'
              ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-400'
              : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dash-green/20 text-xs font-bold text-dash-green'
          }
        >
          {initial}
        </span>
        <div className={`min-w-0 flex-1 ${variant === 'chip' ? 'hidden sm:block' : ''}`}>
          <p
            className={
              variant === 'sidebar'
                ? 'truncate text-xs text-zinc-400'
                : 'max-w-[140px] truncate text-[13px] font-medium text-dash-thi'
            }
          >
            {name}
          </p>
          <p
            className={
              variant === 'sidebar'
                ? 'text-[10px] uppercase tracking-wider text-zinc-600'
                : 'text-[10px] uppercase tracking-wider text-dash-tlo'
            }
          >
            {tier}
          </p>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''} ${
            variant === 'sidebar' ? 'text-zinc-500' : 'text-dash-tlo'
          }`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`absolute z-50 min-w-[11.5rem] overflow-hidden rounded-lg border border-white/[0.08] bg-[#0a0a0a]/98 py-1 shadow-xl backdrop-blur-xl ${
            variant === 'sidebar' ? 'bottom-full left-0 mb-2 w-full' : 'right-0 top-full mt-2'
          }`}
        >
          <p className="px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
            Account
          </p>
          <Link
            href="/pro/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 font-mono text-xs text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-zinc-50"
          >
            <Code2 className="h-3.5 w-3.5 text-sky-400/80" strokeWidth={1.5} />
            <span className="min-w-0 flex-1 truncate">Dashboard Pro</span>
            <span className="shrink-0 rounded border border-sky-400/25 bg-sky-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">
              Dev
            </span>
          </Link>
          <Link
            href="/dashboard/billing"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 font-mono text-xs text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-zinc-50"
          >
            <CreditCard className="h-3.5 w-3.5 text-zinc-500" strokeWidth={1.5} />
            Billing
          </Link>
          <Link
            href="/dashboard/api-keys"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 font-mono text-xs text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-zinc-50"
          >
            <KeyRound className="h-3.5 w-3.5 text-zinc-500" strokeWidth={1.5} />
            API keys
          </Link>
        </div>
      ) : null}
    </div>
  )
}
