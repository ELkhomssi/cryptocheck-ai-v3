'use client'

/**
 * CommandLineInput — Phase 4B
 *
 * The hero of the Analysis Console. User should feel they're at a
 * terminal prompt, not a form field.
 *
 * States:
 *   idle    → cyan ">" prompt, "Scan" submit
 *   loading → "Neural Scan Active" pulse + progress sweep
 *   invalid → inline validation message
 *   error   → scan error bubble from reducer
 *
 * Keyboard wiring (⌘K / Esc / ⌘⇧L) is deferred to Phase D — helper
 * text only for now.
 */

import { Loader2 } from 'lucide-react'
import {
  useCallback,
  useId,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { MINT_INPUT_ID } from '../hooks/useConsoleShortcuts'
import { useTerminal } from '../TerminalProvider'

export function CommandLineInput() {
  const { state, actions } = useTerminal()
  const [mint, setMint] = useState('')
  const validationId = useId()
  const scanErrorId = useId()

  const trimmed = mint.trim()
  const scanning = state.currentScan?.status === 'loading'
  const scanError =
    state.currentScan?.status === 'error' ? state.currentScan.error : null
  const showValidation = trimmed.length > 0 && !isValidSolanaMint(trimmed)
  const canSubmit = !scanning && trimmed.length > 0 && !showValidation

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!canSubmit) return
      await actions.scan(trimmed)
    },
    [actions, canSubmit, trimmed]
  )

  const onInputKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setMint('')
    }
  }, [])

  return (
    <form onSubmit={onSubmit} noValidate className="relative">
      <label
        htmlFor={MINT_INPUT_ID}
        className="mb-3 block font-mono-terminal text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500"
      >
        Mint Address
      </label>

      {/* Prompt row */}
      <div
        className={`
          group relative flex items-center gap-3
          rounded-lg border bg-[#020617]/80 px-4 py-4 md:py-5
          font-mono-terminal transition-colors duration-200
          ${
            scanError
              ? 'border-rose-500/40 focus-within:border-rose-500/60'
              : 'border-white/10 focus-within:border-[#00d4aa]/50 focus-within:shadow-[0_0_0_4px_rgba(0,212,170,0.1)]'
          }
        `}
      >
        <span
          aria-hidden
          className="select-none text-lg font-bold leading-none text-[#00d4aa] motion-safe:animate-pulse"
        >
          &gt;
        </span>

        <input
          id={MINT_INPUT_ID}
          name="mint"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste Solana mint address to scan…"
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          onKeyDown={onInputKeyDown}
          disabled={scanning}
          aria-invalid={showValidation || Boolean(scanError)}
          aria-describedby={
            [
              showValidation ? validationId : '',
              scanError ? scanErrorId : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className="flex-1 bg-transparent font-mono-terminal text-sm text-slate-100 outline-none placeholder:text-slate-600 disabled:opacity-60 md:text-base"
          aria-label="Solana mint address"
        />

        {scanning ? (
          <div className="flex items-center gap-2 font-mono-terminal text-[11px] uppercase tracking-[0.2em] text-[#00d4aa] motion-safe:animate-[neural-pulse_1.5s_ease-in-out_infinite]">
            <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin" aria-hidden />
            <span>Neural Scan</span>
          </div>
        ) : (
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-9 shrink-0 rounded-md bg-[#00d4aa] px-4 font-mono-terminal text-[11px] font-bold uppercase tracking-[0.15em] text-slate-950 transition-colors hover:bg-[#00d4aa]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Scan
          </button>
        )}
      </div>

      {/* Scan progress sweep */}
      {scanning ? (
        <div
          aria-hidden
          className="relative mt-4 h-px overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/5" />
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[#00d4aa] to-transparent motion-safe:animate-[terminal-scan_1.5s_linear_infinite]" />
        </div>
      ) : null}

      {/* Helper text */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono-terminal text-[10px] text-slate-500">
        <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono-terminal text-[10px] text-slate-400">
          ⌘K
        </kbd>
        <span>to focus</span>
        <span className="text-slate-700">·</span>
        <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono-terminal text-[10px] text-slate-400">
          Enter
        </kbd>
        <span>to scan</span>
        <span className="text-slate-700">·</span>
        <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono-terminal text-[10px] text-slate-400">
          Esc
        </kbd>
        <span>to clear</span>
      </div>

      {/* Validation */}
      {showValidation ? (
        <p
          id={validationId}
          role="alert"
          className="mt-3 font-mono-terminal text-xs text-rose-300/90"
        >
          Not a valid Solana mint address (base58, on-curve).
        </p>
      ) : null}

      {/* Scan error */}
      {scanError ? (
        <p
          id={scanErrorId}
          role="alert"
          className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 font-mono-terminal text-xs text-rose-200"
        >
          {scanError}
        </p>
      ) : null}
    </form>
  )
}
