'use client'

import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
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
  const [value, setValue] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const errorId = useId()

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const handleRateLimitExpire = useCallback(() => {
    if (state.rateLimited && Date.now() >= state.rateLimited.until) {
      actions.clearRateLimit()
    }
  }, [actions, state.rateLimited])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || state.phase === 'verifying') return
    await actions.verifyKey(trimmed)
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
    <div className="mx-auto w-full max-w-[480px] px-6 py-8 md:px-10 md:py-12">
      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">Intelligence Terminal</h1>
        <p className="mt-2 text-sm text-slate-400">Paste your access key to unlock</p>

        {state.cryptoWarning === 'weak' ? (
          <div
            className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90"
            role="status"
          >
            This browser does not expose strong Web Crypto. Your key may be stored with weaker protection. Use a current
            browser for the best security.
          </div>
        ) : null}

        {state.cryptoWarning === 'stale' ? (
          <div
            className="mt-4 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100/95"
            role="status"
          >
            Your session expired — paste your key again
          </div>
        ) : null}

        <form className="mt-6" onSubmit={onSubmit}>
          <label htmlFor="terminal-access-key" className="text-xs font-medium uppercase tracking-widest text-slate-500">
            Access key
          </label>
          <div className="relative mt-2">
            <input
              ref={inputRef}
              id="terminal-access-key"
              name="accessKey"
              type={showPassword ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder="cc_live_... or cc_sentinel_..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isVerifying}
              aria-invalid={hasInlineError}
              aria-describedby={hasInlineError ? errorId : undefined}
              className="h-12 w-full rounded-md border border-white/10 bg-slate-950 px-4 pr-12 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#00d4aa]/50 focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/20 focus-visible:ring-2 focus-visible:ring-[#00d4aa]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa]"
              aria-label={showPassword ? 'Hide access key' : 'Show access key'}
              tabIndex={0}
            >
              {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
            </button>
          </div>

          {showRateLimitError && rateLimited ? (
            <p id={errorId} role="alert" className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              Too many attempts. Try again in{' '}
              <RateLimitCountdown until={rateLimited.until} onExpire={handleRateLimitExpire} />s.
            </p>
          ) : showOtherError && verifyError ? (
            <p id={errorId} role="alert" className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {mapVerifyErrorMessage(verifyError)}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isVerifying || !value.trim()}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#00d4aa] font-medium text-slate-950 hover:bg-[#00d4aa]/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-5 w-5 shrink-0 motion-safe:animate-spin" aria-hidden />
                <span>Verifying...</span>
              </>
            ) : (
              'Verify & Unlock'
            )}
          </button>
        </form>

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
