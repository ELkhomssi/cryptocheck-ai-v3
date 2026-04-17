'use client'

import { MintScanner } from './MintScanner'
import { useTerminal } from './TerminalProvider'

function tierBadgeClasses(tier: 'FREE' | 'PRO' | 'ENTERPRISE'): string {
  if (tier === 'ENTERPRISE') {
    return 'border-amber-400/35 bg-amber-500/10 text-amber-100'
  }
  if (tier === 'PRO') {
    return 'border-[#00d4aa]/35 bg-[#00d4aa]/10 text-[#00d4aa]'
  }
  return 'border-slate-500/35 bg-slate-800/80 text-slate-300'
}

export function PlaceholderConsole() {
  const { state, actions } = useTerminal()
  const key = state.key
  if (!key) return null

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 md:px-6">
      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md md:p-8">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Analysis Console</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-100">Session</h1>

        <div className="mt-6 space-y-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Key (masked)</p>
            <code className="mt-1 block rounded-md border border-white/10 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200">
              {key.masked}
            </code>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-widest text-slate-500">Tier</span>
            <span
              className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${tierBadgeClasses(key.subscriptionTier)}`}
            >
              {key.subscriptionTier}
            </span>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Key name</p>
            <p className="mt-1 font-medium text-slate-200">{key.keyName}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Rate limit</p>
            <p className="mt-1 tabular-nums text-slate-300">
              {key.rateLimit.maxRequests} req / {key.rateLimit.windowSeconds}s
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => actions.clearKey()}
          className="mt-8 w-full rounded-md border border-rose-500/35 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 md:w-auto"
        >
          Clear key
        </button>
      </div>

      <MintScanner />
    </div>
  )
}
