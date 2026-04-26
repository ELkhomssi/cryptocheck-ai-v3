'use client'

import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { readCryptocheckAccessKeyFromLocalStorage } from '@/lib/auth/cryptocheck-access-key'
import { useTerminal } from './TerminalProvider'

function RateLimitCountdown({ until, onExpire }: { until: number; onExpire?: () => void }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [until])

  const secondsLeft = Math.max(0, Math.ceil((until - Date.now()) / 1000))

  useEffect(() => {
    if (secondsLeft === 0) onExpire?.()
  }, [secondsLeft, onExpire])

  return <span>{secondsLeft}</span>
}

function mapVerifyErrorMessage(verifyError: string | null): string | null {
  if (!verifyError) return null
  if (verifyError === 'Invalid key') {
    return "This key isn't valid. Check and try again."
  }
  if (verifyError === 'Revoked') {
    return 'This key has been revoked. Generate a new one.'
  }
  if (verifyError === 'Network error') {
    return 'Network error. Check your connection.'
  }
  if (verifyError === 'Rate limited') {
    return null
  }
  if (verifyError.startsWith('Session expired')) {
    return 'Session expired. Paste your key again.'
  }
  return 'Something went wrong. Try again.'
}

export function TerminalGate() {
  const { state, actions } = useTerminal()
  const inputRef = useRef<HTMLInputElement>(null)
  const [accessKey, setAccessKey] = useState('')
  const [showKey, setShowKey] = useState(true)
  const errorId = useId()

  useEffect(() => {
    const stored = readCryptocheckAccessKeyFromLocalStorage()
    if (stored) {
      setAccessKey((prev) => (prev.trim() ? prev : stored))
    }
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const handleRateLimitExpire = useCallback(() => {
    if (state.rateLimited && Date.now() >= state.rateLimited.until) {
      actions.clearRateLimit()
    }
  }, [actions, state.rateLimited])

  const handleVerify = useCallback(async () => {
    const trimmed = accessKey.trim()
    if (!trimmed || state.phase === 'verifying') return
    await actions.verifyKey(trimmed)
  }, [accessKey, state.phase, actions])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await handleVerify()
  }

  const verifyError = state.verifyError
  const rateLimited = state.rateLimited
  const rateWindowActive = Boolean(rateLimited && Date.now() < rateLimited.until)
  const showRateLimitError = rateWindowActive && (verifyError === 'Rate limited' || verifyError === null)
  const showOtherError = Boolean(
    verifyError && verifyError !== 'Rate limited' && mapVerifyErrorMessage(verifyError)
  )
  const hasInlineError = showRateLimitError || showOtherError

  const isVerifying = state.phase === 'verifying'

  return (
    <div className="mx-auto w-full max-w-[560px] px-6 py-8 font-mono-terminal md:px-10 md:py-12">
      <div className="rounded-xl border border-white/10 bg-slate-900/70 p-6 shadow-xl backdrop-blur-md md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">Analysis Console</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Enter your access key to unlock the neural terminal. The same key unlocks Pro features across CryptoCheck AI.
        </p>

        <form className="mt-5" onSubmit={onSubmit} noValidate>
          <label htmlFor="terminal-access-key" className="block text-xs font-semibold uppercase tracking-widest text-slate-400">
            CryptoCheck AI access key
          </label>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="relative min-w-0 flex-1">
              <input
                ref={inputRef}
                id="terminal-access-key"
                name="accessKey"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                placeholder="cc_live_… or cc_sentinel_2_…"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                disabled={isVerifying}
                aria-invalid={hasInlineError}
                aria-describedby={hasInlineError ? errorId : undefined}
                className="
                  h-14 w-full min-h-[3.25rem] rounded-lg border border-white/20 bg-[#030712] px-4 py-3 pr-12
                  font-mono-terminal text-base font-medium tracking-wide text-white
                  shadow-inner shadow-black/40
                  placeholder:text-slate-500
                  focus:border-[#00d4aa]/70 focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/35
                  disabled:cursor-not-allowed disabled:opacity-60
                "
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa]"
                aria-label={showKey ? 'Hide access key' : 'Show access key'}
                tabIndex={0}
              >
                {showKey ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
              </button>
            </div>

            <button
              type="submit"
              disabled={isVerifying || !accessKey.trim()}
              className="
                flex h-14 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#00d4aa]/40
                bg-[#00d4aa] px-6 font-semibold text-[#030712] shadow-[0_0_24px_rgba(0,212,170,0.25)]
                transition-colors hover:bg-[#00e6b8] disabled:cursor-not-allowed disabled:opacity-45
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#030712]
                sm:min-w-[168px]
              "
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-5 w-5 shrink-0 motion-safe:animate-spin" aria-hidden />
                  <span>Verifying…</span>
                </>
              ) : (
                'Verify & Unlock'
              )}
            </button>
          </div>

          {showRateLimitError && rateLimited ? (
            <p id={errorId} role="alert" className="mt-3 rounded-md border border-red-500/25 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              Too many attempts. Try again in{' '}
              <RateLimitCountdown until={rateLimited.until} onExpire={handleRateLimitExpire} />s.
            </p>
          ) : showOtherError && verifyError ? (
            <p id={errorId} role="alert" className="mt-3 rounded-md border border-red-500/25 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {mapVerifyErrorMessage(verifyError)}
            </p>
          ) : null}
        </form>

        {state.cryptoWarning === 'weak' ? (
          <div
            className="mt-5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90"
            role="status"
          >
            This browser does not expose strong Web Crypto. Your key may be stored with weaker protection. Use a current
            browser for the best security.
          </div>
        ) : null}

        {state.cryptoWarning === 'stale' ? (
          <div
            className="mt-5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100/95"
            role="status"
          >
            Your session expired — paste your key again
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-2 text-xs text-slate-400 md:flex-row md:flex-wrap md:justify-between md:gap-4">
          <Link
            href="/dashboard/api-keys"
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa] hover:text-[#00d4aa]"
          >
            Don&apos;t have a key? Generate one →
          </Link>
          <Link
            href="/dashboard/billing"
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa] hover:text-[#00d4aa]"
          >
            Need more throughput? Upgrade to Sentinel →
          </Link>
        </div>
      </div>
    </div>
  )
}
