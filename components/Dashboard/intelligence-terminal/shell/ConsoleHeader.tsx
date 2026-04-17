'use client'

/**
 * ConsoleHeader — Phase 4B
 *
 * Top strip of the Analysis Console. Three zones:
 *   Left:   live status dot + SENTINEL ACTIVE label
 *   Center: masked API key + tier badge pill
 *   Right:  Lock / Exit action buttons
 *
 * Status dot tone reflects real session health:
 *   green  = operational  (default)
 *   amber  = degraded     (rateLimited OR cryptoWarning)
 */

import { Lock, LogOut } from 'lucide-react'
import { useTerminal } from '../TerminalProvider'

type Tier = 'FREE' | 'PRO' | 'ENTERPRISE'

function tierBadgeClasses(tier: Tier): string {
  switch (tier) {
    case 'ENTERPRISE':
      return 'border-amber-400/40 bg-amber-500/10 text-amber-200 shadow-[0_0_20px_rgba(240,165,0,0.18)]'
    case 'PRO':
      return 'border-[#00d4aa]/40 bg-[#00d4aa]/10 text-[#00d4aa] shadow-[0_0_18px_rgba(0,212,170,0.18)]'
    default:
      return 'border-white/10 bg-white/5 text-slate-300'
  }
}

export function ConsoleHeader() {
  const { state, actions } = useTerminal()
  const key = state.key
  if (!key) return null

  const degraded =
    Boolean(state.rateLimited) || state.cryptoWarning !== null
  const statusLabel = degraded ? 'SENTINEL DEGRADED' : 'SENTINEL ACTIVE'
  const dotColor = degraded ? '#ffa502' : '#00d4aa'

  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-white/5 pb-4 md:flex-row md:items-center md:justify-between">
      {/* Left — status */}
      <div className="flex items-center gap-2.5">
        <span className="relative inline-flex h-2 w-2 shrink-0">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full motion-safe:animate-ping"
            style={{ backgroundColor: dotColor, opacity: 0.4 }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
        </span>
        <span
          className="font-mono-terminal text-[10px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: dotColor }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Center — masked key + tier */}
      <div className="flex min-w-0 flex-1 items-center justify-start gap-3 md:justify-center">
        <code
          className="min-w-0 truncate rounded-md border border-white/5 bg-black/40 px-2.5 py-1 font-mono-terminal text-xs text-slate-300"
          title={key.keyName}
        >
          {key.masked}
        </code>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono-terminal text-[10px] font-bold uppercase tracking-[0.2em] ${tierBadgeClasses(
            key.subscriptionTier
          )}`}
        >
          {key.subscriptionTier}
        </span>
      </div>

      {/* Right — actions */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={actions.lock}
          aria-label="Lock terminal session (Cmd+Shift+L)"
          title="Lock (⌘⇧L)"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 font-mono-terminal text-[11px] font-medium uppercase tracking-wider text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
        >
          <Lock className="h-3.5 w-3.5" aria-hidden />
          <span>Lock</span>
        </button>
        <button
          type="button"
          onClick={actions.clearKey}
          aria-label="Exit and clear session key"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 font-mono-terminal text-[11px] font-medium uppercase tracking-wider text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          <span>Exit</span>
        </button>
      </div>
    </header>
  )
}
