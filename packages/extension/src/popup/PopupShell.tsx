import { IntelReportCardsView } from '@/components/Dashboard/intelligence-terminal/IntelReportCards'
import { Eye, EyeOff, Loader2, Radar } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { BrandLogo, BrandWordmark } from '../components/BrandLogo'
import { useExtensionTerminal } from './ExtensionTerminalProvider'

/** Pro AI terminal panel — slate glass + subtle cyan ambience */
const shell =
  'rounded-2xl border border-white/[0.07] bg-slate-950/85 p-5 shadow-glass backdrop-blur-xl ring-1 ring-white/[0.05] shadow-[0_0_48px_-18px_rgba(0,212,170,0.14)]'

const scanButton =
  'inline-flex min-h-[2.5rem] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#00d4aa] px-4 text-xs font-semibold tracking-wide text-slate-950 shadow-cc-glow transition-all duration-200 hover:shadow-cc-glow-lg hover:brightness-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-45'

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
      <div className="flex min-h-[220px] items-center justify-center bg-gradient-to-b from-slate-950 via-slate-950 to-black/90 px-4 py-12">
        <Loader2
          className="h-9 w-9 motion-safe:animate-spin text-[#00d4aa] drop-shadow-[0_0_12px_rgba(0,212,170,0.45)]"
          aria-hidden
        />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (state.phase === 'unlocked' && state.key) {
    return (
      <div className="space-y-5 bg-gradient-to-b from-slate-950 via-slate-950 to-black/90 px-4 py-6 [color-scheme:dark]">
        <div className={shell}>
          <div className="flex gap-3">
            <BrandLogo size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Session</p>
                <span className="hidden h-3 w-px bg-white/10 sm:inline" aria-hidden />
                <BrandWordmark className="text-sm" />
              </div>
              <p className="mt-2 break-all font-mono text-sm text-[#00d4aa]/95">{state.key.masked}</p>
              <p className="mt-1 text-xs text-slate-400">
                {state.key.subscriptionTier} · {state.key.rateLimit.maxRequests} req / {state.key.rateLimit.windowSeconds}s
              </p>
              <button
                type="button"
                onClick={() => void clearKey()}
                className="mt-4 rounded-xl border border-rose-500/35 bg-rose-500/[0.12] px-3.5 py-2 text-xs font-semibold text-rose-100 backdrop-blur-sm transition hover:border-rose-400/45 hover:bg-rose-500/20"
              >
                Clear key
              </button>
            </div>
          </div>
        </div>

        <div className={shell}>
          <div className="flex items-center gap-2.5 text-slate-200">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00d4aa]/25 bg-[#00d4aa]/10 text-[#00d4aa] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <Radar className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Neural scan</p>
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-slate-500">Token intelligence</p>
            </div>
          </div>
          <form className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch" onSubmit={onScan}>
            <input
              className="min-h-[2.75rem] min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/90 px-3.5 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-600 shadow-inner shadow-black/20 transition focus:border-[#00d4aa]/45 focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/25"
              placeholder="Solana mint address"
              value={mint}
              onChange={(e) => setMint(e.target.value)}
              disabled={scanBusy}
              aria-busy={scanBusy}
            />
            <button type="submit" disabled={scanBusy || !mint.trim()} className={scanButton}>
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
            <p role="alert" className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100/95">
              {scanError}
            </p>
          ) : null}
        </div>

        {scanReport ? (
          <div className="max-h-[min(70vh,560px)] overflow-y-auto overflow-x-hidden rounded-2xl pr-0.5">
            <IntelReportCardsView report={scanReport} className="space-y-4 pb-1" />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-b from-slate-950 via-slate-950 to-black/90 px-4 py-6 [color-scheme:dark]">
      <div className={shell}>
        <div className="flex items-start gap-3">
          <BrandLogo size={44} />
          <div className="min-w-0 pt-0.5">
            <BrandWordmark className="text-lg" />
            <p className="mt-1 text-sm leading-relaxed text-slate-400">
              Enter your access key to unlock the neural terminal.
            </p>
          </div>
        </div>

        {state.cryptoWarning === 'weak' ? (
          <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-100/95 backdrop-blur-sm">
            Strong Web Crypto not available in this context.
          </p>
        ) : null}
        {state.cryptoWarning === 'stale' ? (
          <p className="mt-4 rounded-xl border border-[#00d4aa]/25 bg-[#00d4aa]/10 px-3.5 py-2.5 text-xs leading-relaxed text-cyan-50/95 backdrop-blur-sm">
            Session salt missing — paste your key again.
          </p>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onUnlock}>
          <label htmlFor="cc-api-key" className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Access key
          </label>
          <div className="relative">
            <input
              id="cc-api-key"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-white/10 bg-slate-950/90 pr-11 pl-3.5 font-mono text-sm text-slate-100 shadow-inner shadow-black/25 transition focus:border-[#00d4aa]/45 focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/20"
              placeholder="cc_live_…"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              disabled={state.phase === 'verifying'}
              aria-invalid={Boolean(state.verifyError)}
              aria-describedby={state.verifyError ? errId : undefined}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
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
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold ${scanButton}`}
          >
            {state.phase === 'verifying' ? (
              <>
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                Verifying…
              </>
            ) : (
              'Unlock terminal'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
