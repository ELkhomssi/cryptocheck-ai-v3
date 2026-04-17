import { IntelReportCardsView } from '@/components/Dashboard/intelligence-terminal/IntelReportCards'
import { Eye, EyeOff, Loader2, Search } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useExtensionTerminal } from './ExtensionTerminalProvider'

export function PopupShell() {
  const { state, verifyKey, clearKey, scan } = useExtensionTerminal()
  const [keyInput, setKeyInput] = useState('')
  const [mint, setMint] = useState('')
  const [showKey, setShowKey] = useState(false)
  const errId = useId()

  const onUnlock = async (e: FormEvent) => {
    e.preventDefault()
    await verifyKey(keyInput)
  }

  const onScan = (e: FormEvent) => {
    e.preventDefault()
    void scan(mint)
  }

  const scanBusy = state.currentScan?.status === 'loading'
  const scanError = state.currentScan?.status === 'error' ? state.currentScan.error : null
  const scanReport = state.currentScan?.report ?? null

  if (state.hydrating) {
    return (
      <div className="flex min-h-[200px] items-center justify-center px-4 py-12">
        <Loader2 className="h-9 w-9 motion-safe:animate-spin text-[#00d4aa]" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (state.phase === 'unlocked' && state.key) {
    return (
      <div className="space-y-4 px-4 py-5">
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 shadow-glass backdrop-blur-md">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">Session</p>
          <p className="mt-2 font-mono text-sm text-[#00d4aa]/90">{state.key.masked}</p>
          <p className="mt-1 text-xs text-slate-400">
            {state.key.subscriptionTier} · {state.key.rateLimit.maxRequests} req / {state.key.rateLimit.windowSeconds}s
          </p>
          <button
            type="button"
            onClick={() => void clearKey()}
            className="mt-4 rounded-md border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
          >
            Clear key
          </button>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 shadow-glass backdrop-blur-md">
          <div className="flex items-center gap-2 text-slate-300">
            <Search className="h-4 w-4 text-[#00d4aa]" aria-hidden />
            <span className="text-sm font-semibold">Neural scan</span>
          </div>
          <form className="mt-4 flex gap-2" onSubmit={onScan}>
            <input
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-[#00d4aa]/50 focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/20"
              placeholder="Solana mint address"
              value={mint}
              onChange={(e) => setMint(e.target.value)}
              disabled={scanBusy}
              aria-busy={scanBusy}
            />
            <button
              type="submit"
              disabled={scanBusy || !mint.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#00d4aa] px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-[#00d4aa]/90 disabled:opacity-50"
            >
              {scanBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
                  Scanning…
                </>
              ) : (
                'Scan'
              )}
            </button>
          </form>
          {scanError ? (
            <p role="alert" className="mt-3 text-xs text-rose-300/95">
              {scanError}
            </p>
          ) : null}
        </div>

        {scanReport ? (
          <div className="max-h-[min(70vh,560px)] overflow-y-auto pr-0.5">
            <IntelReportCardsView report={scanReport} className="space-y-4" />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="px-4 py-5">
      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-5 shadow-glass backdrop-blur-md">
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">CryptoCheck AI</h1>
        <p className="mt-1 text-sm text-slate-400">Paste your API key to unlock the terminal.</p>

        {state.cryptoWarning === 'weak' ? (
          <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
            Strong Web Crypto not available in this context.
          </p>
        ) : null}
        {state.cryptoWarning === 'stale' ? (
          <p className="mt-3 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100/95">
            Session salt missing — paste your key again.
          </p>
        ) : null}

        <form className="mt-5 space-y-3" onSubmit={onUnlock}>
          <label htmlFor="cc-api-key" className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Access key
          </label>
          <div className="relative">
            <input
              id="cc-api-key"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              className="h-11 w-full rounded-md border border-white/10 bg-slate-950 pr-10 pl-3 font-mono text-sm text-slate-100 focus:border-[#00d4aa]/50 focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/20"
              placeholder="cc_live_…"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              disabled={state.phase === 'verifying'}
              aria-invalid={Boolean(state.verifyError)}
              aria-describedby={state.verifyError ? errId : undefined}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-200"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {state.verifyError ? (
            <p id={errId} role="alert" className="text-sm text-rose-300/95">
              {state.verifyError === 'Invalid key'
                ? "Key isn't valid."
                : state.verifyError === 'Network error'
                  ? 'Network error.'
                  : state.verifyError === 'Rate limited'
                    ? 'Too many attempts.'
                    : state.verifyError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={state.phase === 'verifying' || !keyInput.trim()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#00d4aa] font-semibold text-slate-950 hover:bg-[#00d4aa]/90 disabled:opacity-50"
          >
            {state.phase === 'verifying' ? (
              <>
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                Verifying…
              </>
            ) : (
              'Unlock'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
