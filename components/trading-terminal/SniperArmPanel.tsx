'use client'

import { useEffect, useState } from 'react'
import { scanToVerdictCard } from '@/lib/trading-terminal/map-verdict'
import { evaluateSniperAbort } from '@/lib/trading-terminal/sniper-abort'
import {
  canArmSniper,
  defaultSniperState,
  loadSniperState,
  saveSniperState,
  type SniperArmState,
} from '@/lib/trading-terminal/sniper-state'
import type { ScanResult } from '@/lib/revenue-dashboard/types'
import { useTerminalFocus } from './TerminalFocusProvider'

async function scanMint(mint: string): Promise<ScanResult | null> {
  try {
    const res = await fetch('/api/revenue/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint }),
    })
    if (!res.ok) return null
    return (await res.json()) as ScanResult
  } catch {
    return null
  }
}

export function SniperArmPanel() {
  const { focusMint, focusSymbol, scan, selectMint } = useTerminalFocus()
  const [state, setState] = useState<SniperArmState>(() => loadSniperState())
  const [lastAbort, setLastAbort] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const card = scanToVerdictCard(scan)

  useEffect(() => {
    saveSniperState(state)
  }, [state])

  // Live risk rail while armed — ~45s (honest scan, not fake urgency)
  useEffect(() => {
    if (!state.armed || state.mint.length < 32) return
    let cancelled = false

    const tick = async () => {
      setPolling(true)
      const result = await scanMint(state.mint)
      if (cancelled) return
      setPolling(false)
      if (!result) return
      const v = scanToVerdictCard(result)
      const ev = evaluateSniperAbort({
        state,
        focusMint: state.mint,
        riskScore: v?.riskScore ?? null,
        verdict: v?.verdict ?? null,
      })
      if (ev.abort) {
        setLastAbort(ev.detail)
        setState((s) => ({
          ...s,
          armed: false,
          armedAt: null,
          riskAck: false,
        }))
      }
    }

    void tick()
    const id = window.setInterval(() => void tick(), 45_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [state.armed, state.mint, state.maxRiskScore])

  // Focus mint mismatch while armed
  useEffect(() => {
    if (!state.armed) return
    const ev = evaluateSniperAbort({
      state,
      focusMint,
      riskScore: null,
      verdict: null,
    })
    if (ev.reason === 'mint_mismatch') {
      setLastAbort(ev.detail)
      setState((s) => ({ ...s, armed: false, armedAt: null, riskAck: false }))
    }
  }, [focusMint, state.armed, state.mint, state.maxRiskScore])

  const disarm = () => {
    setState((s) => ({
      ...s,
      armed: false,
      armedAt: null,
      riskAck: false,
    }))
    setLastAbort(null)
  }

  const tryArm = () => {
    const check = canArmSniper({
      mint: focusMint,
      riskScore: card?.riskScore ?? null,
      verdict: card?.verdict ?? null,
      maxRiskScore: state.maxRiskScore,
      riskAck: state.riskAck,
      maxSol: state.maxSol,
    })
    if (!check.ok) return
    setLastAbort(null)
    setState((s) => ({
      ...s,
      armed: true,
      mint: focusMint,
      symbol: focusSymbol || card?.mint.slice(0, 6) || '',
      verdictAtArm: card?.verdict ?? null,
      riskScoreAtArm: card?.riskScore ?? null,
      armedAt: new Date().toISOString(),
    }))
  }

  const armCheck = canArmSniper({
    mint: focusMint,
    riskScore: card?.riskScore ?? null,
    verdict: card?.verdict ?? null,
    maxRiskScore: state.maxRiskScore,
    riskAck: state.riskAck,
    maxSol: state.maxSol,
  })

  return (
    <div className="mx-2 mb-2 rounded border border-white/10 bg-[var(--tit-bg-2)] px-3 py-2">
      <div className="flex items-center justify-between">
        <p className="tit-label">Sniper (V2)</p>
        <span
          className={`tit-mono text-[0.6rem] uppercase ${
            state.armed ? 'text-[var(--tit-ember)]' : 'text-[var(--tit-text-2)]'
          }`}
        >
          {state.armed ? (polling ? 'armed·scan' : 'armed') : 'disarmed'}
        </span>
      </div>

      <p className="mt-1 text-[0.65rem] text-[var(--tit-text-2)]">
        Intent + live risk abort. No auto-submit. Rescan every 45s while armed; disarm on BLOCKED or
        risk ≥ threshold.
      </p>

      {lastAbort ? (
        <p className="mt-1 text-[0.65rem] text-[var(--tit-neg)]" role="status">
          Auto-disarmed: {lastAbort}
        </p>
      ) : null}

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[0.6rem] text-[var(--tit-text-2)]">
          Max SOL
          <input
            type="number"
            min={0.01}
            step={0.1}
            value={state.maxSol}
            disabled={state.armed}
            onChange={(e) =>
              setState((s) => ({ ...s, maxSol: Number(e.target.value) || 0 }))
            }
            className="tit-mono mt-0.5 w-full rounded border border-white/10 bg-[var(--tit-bg-0)] px-2 py-1 text-xs text-[var(--tit-text-0)]"
          />
        </label>
        <label className="text-[0.6rem] text-[var(--tit-text-2)]">
          Abort risk ≥
          <input
            type="number"
            min={1}
            max={100}
            value={state.maxRiskScore}
            disabled={state.armed}
            onChange={(e) =>
              setState((s) => ({ ...s, maxRiskScore: Number(e.target.value) || 70 }))
            }
            className="tit-mono mt-0.5 w-full rounded border border-white/10 bg-[var(--tit-bg-0)] px-2 py-1 text-xs text-[var(--tit-text-0)]"
          />
        </label>
      </div>

      {!state.armed ? (
        <div className="mt-2 space-y-2">
          <div className="rounded border border-[var(--tit-warn)]/30 bg-[var(--tit-warn)]/5 px-2 py-1.5 text-[0.65rem] text-[var(--tit-text-1)]">
            <p className="font-semibold text-[var(--tit-warn)]">Pre-arm risk summary</p>
            <p className="mt-0.5">
              Mint {focusSymbol || '—'} · verdict {card?.verdict ?? 'none'} · risk{' '}
              {card?.riskScore ?? '—'} · evidence{' '}
              {card
                ? `${card.evidence.present.length}/${card.evidence.required.length}`
                : '—'}
            </p>
            <p className="mt-0.5 text-[var(--tit-text-2)]">
              Max spend {state.maxSol} SOL · auto-abort if risk ≥ {state.maxRiskScore}
            </p>
          </div>
          <label className="flex items-start gap-2 text-[0.65rem] text-[var(--tit-text-1)]">
            <input
              type="checkbox"
              checked={state.riskAck}
              onChange={(e) => setState((s) => ({ ...s, riskAck: e.target.checked }))}
              className="mt-0.5"
            />
            I reviewed the pre-arm summary. Not financial advice.
          </label>
          {!armCheck.ok ? (
            <p className="text-[0.6rem] text-[var(--tit-warn)]">{armCheck.reason}</p>
          ) : null}
          <button
            type="button"
            disabled={!armCheck.ok}
            onClick={tryArm}
            className="tit-btn-ember w-full py-1.5 text-[0.7rem] disabled:opacity-40"
          >
            Arm sniper on focus
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="tit-mono text-[0.65rem] text-[var(--tit-text-1)]">
            Armed {state.symbol} · {state.armedAt?.slice(0, 19)} · verdict {state.verdictAtArm} ·
            risk {state.riskScoreAtArm ?? '—'}
          </p>
          <button
            type="button"
            onClick={() => selectMint(state.mint, state.symbol)}
            className="w-full rounded border border-white/15 py-1 text-[0.65rem] text-[var(--tit-text-1)]"
          >
            Focus armed mint
          </button>
          <button
            type="button"
            onClick={disarm}
            className="w-full rounded border border-white/15 py-1.5 text-[0.7rem] text-[var(--tit-text-1)]"
          >
            Disarm
          </button>
          <button
            type="button"
            onClick={() => {
              setState(defaultSniperState())
              setLastAbort(null)
            }}
            className="w-full text-[0.55rem] text-[var(--tit-text-2)] underline"
          >
            Reset sniper prefs
          </button>
        </div>
      )}
    </div>
  )
}
