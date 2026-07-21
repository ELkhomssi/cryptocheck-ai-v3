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

export function SniperArmPanel({ compact = false }: { compact?: boolean }) {
  const { focusMint, focusSymbol, scan, selectMint } = useTerminalFocus()
  const [state, setState] = useState<SniperArmState>(() => loadSniperState())
  const [lastAbort, setLastAbort] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const card = scanToVerdictCard(scan)

  useEffect(() => {
    saveSniperState(state)
  }, [state])

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
    setState((s) => ({ ...s, armed: false, armedAt: null, riskAck: false }))
    setLastAbort(null)
  }

  const tryArm = () => {
    const check = canArmSniper({
      mint: focusMint,
      riskScore: card?.riskScore ?? null,
      verdict: card?.verdict ?? null,
      maxRiskScore: state.maxRiskScore,
      riskAck: true,
      maxSol: state.maxSol,
    })
    if (!check.ok && !state.riskAck) {
      setState((s) => ({ ...s, riskAck: true }))
      return
    }
    if (!check.ok) return
    setLastAbort(null)
    setState((s) => ({
      ...s,
      armed: true,
      riskAck: true,
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
    riskAck: state.riskAck || compact,
    maxSol: state.maxSol,
  })

  if (compact) {
    const target = state.armed
      ? `${state.symbol || '—'}/SOL`
      : focusSymbol
        ? `${focusSymbol}/SOL`
        : '—'
    const riskLvl =
      (card?.riskScore ?? 0) >= 70 ? 'HIGH' : (card?.riskScore ?? 0) >= 40 ? 'MED' : 'LOW'
    const rescanSec = state.armed && state.armedAt
      ? Math.max(0, 45 - Math.floor((Date.now() - Date.parse(state.armedAt)) / 1000) % 45)
      : null

    return (
      <div className="tit-panel-flat flex h-full flex-col justify-center gap-1 px-3 py-1.5">
        <div className="flex items-center justify-between">
          <p className="tit-label">Sniper</p>
          <div className="flex items-center gap-1.5">
            <span
              className={`tit-mono rounded px-1.5 py-0.5 text-[0.55rem] font-bold uppercase ${
                state.armed
                  ? 'bg-[var(--tit-pos)]/15 text-[var(--tit-pos)]'
                  : 'bg-[var(--tit-bg-3)] text-[var(--tit-text-2)]'
              }`}
            >
              {state.armed ? (polling ? 'ARMED · SCAN' : 'ARMED') : 'DISARMED'}
            </span>
            {state.armed ? (
              <button
                type="button"
                onClick={disarm}
                className="rounded border border-[var(--tit-border)] px-1.5 py-0.5 text-[0.5rem] font-bold text-[var(--tit-text-1)]"
              >
                Disarm
              </button>
            ) : (
              <button
                type="button"
                disabled={!focusMint || card?.verdict === 'BLOCKED'}
                onClick={() => {
                  const check = canArmSniper({
                    mint: focusMint,
                    riskScore: card?.riskScore ?? null,
                    verdict: card?.verdict ?? null,
                    maxRiskScore: state.maxRiskScore,
                    riskAck: true,
                    maxSol: state.maxSol,
                  })
                  if (!check.ok) return
                  setLastAbort(null)
                  setState((s) => ({
                    ...s,
                    armed: true,
                    riskAck: true,
                    mint: focusMint,
                    symbol: focusSymbol || card?.mint.slice(0, 6) || '',
                    verdictAtArm: card?.verdict ?? null,
                    riskScoreAtArm: card?.riskScore ?? null,
                    armedAt: new Date().toISOString(),
                  }))
                }}
                className="tit-btn-accent px-2 py-0.5 text-[0.55rem] disabled:opacity-40"
              >
                ARM
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="tit-label !text-[8px]">Target</p>
            <p className="tit-mono truncate text-[0.65rem] text-[var(--tit-text-0)]">{target}</p>
          </div>
          <div>
            <p className="tit-label !text-[8px]">Rescan in</p>
            <p className="tit-mono text-[0.65rem] text-[var(--tit-text-0)]">
              {rescanSec != null
                ? `00:${String(rescanSec).padStart(2, '0')}`
                : '—'}
            </p>
          </div>
          <div>
            <p className="tit-label !text-[8px]">Risk monitor</p>
            <p
              className={`tit-mono text-[0.65rem] font-bold ${
                riskLvl === 'HIGH'
                  ? 'text-[var(--tit-neg)]'
                  : riskLvl === 'MED'
                    ? 'text-[var(--tit-warn)]'
                    : 'text-[var(--tit-pos)]'
              }`}
            >
              {riskLvl}
            </p>
          </div>
        </div>
        {lastAbort ? (
          <p className="text-[0.55rem] text-[var(--tit-neg)]">{lastAbort}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded border border-[var(--tit-border)] bg-[var(--tit-bg-2)] px-3 py-2">
      <div className="flex items-center justify-between">
        <p className="tit-label">Sniper</p>
        <span
          className={`tit-mono text-[0.6rem] uppercase ${
            state.armed ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-text-2)]'
          }`}
        >
          {state.armed ? (polling ? 'armed·scan' : 'armed') : 'disarmed'}
        </span>
      </div>
      <p className="mt-1 text-[0.65rem] text-[var(--tit-text-2)]">
        Intent + live risk abort. No auto-submit.
      </p>
      {lastAbort ? (
        <p className="mt-1 text-[0.65rem] text-[var(--tit-neg)]">Auto-disarmed: {lastAbort}</p>
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
            onChange={(e) => setState((s) => ({ ...s, maxSol: Number(e.target.value) || 0 }))}
            className="tit-input tit-mono mt-0.5 w-full"
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
            className="tit-input tit-mono mt-0.5 w-full"
          />
        </label>
      </div>
      {!state.armed ? (
        <div className="mt-2 space-y-2">
          <label className="flex items-start gap-2 text-[0.65rem] text-[var(--tit-text-1)]">
            <input
              type="checkbox"
              checked={state.riskAck}
              onChange={(e) => setState((s) => ({ ...s, riskAck: e.target.checked }))}
              className="mt-0.5"
            />
            I reviewed pre-arm risk. Not financial advice.
          </label>
          {armCheck.reason ? (
            <p className="text-[0.6rem] text-[var(--tit-warn)]">{armCheck.reason}</p>
          ) : null}
          <button
            type="button"
            disabled={!armCheck.ok}
            onClick={tryArm}
            className="tit-btn-accent w-full py-1.5 disabled:opacity-40"
          >
            Arm sniper on focus
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <button
            type="button"
            onClick={() => selectMint(state.mint, state.symbol)}
            className="w-full rounded border border-[var(--tit-border)] py-1 text-[0.65rem]"
          >
            Focus armed mint
          </button>
          <button
            type="button"
            onClick={disarm}
            className="w-full rounded border border-[var(--tit-border)] py-1.5 text-[0.7rem]"
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
