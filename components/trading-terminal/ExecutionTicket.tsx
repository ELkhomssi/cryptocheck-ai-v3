'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { RiskGatedSwapPanel } from '@/components/trading/RiskGatedSwapPanel'
import {
  COMPLIANCE_DISCLAIMER,
  FEE_DISCLOSURE_PATH,
  SOL_MINT,
  TERMS_PATH,
} from '@/lib/trading-terminal/constants'
import {
  appendOverrideLog,
  evaluateCoachInterrupts,
  hasHardBlock,
  hasSoftGate,
  loadMutes,
  saveMute,
  type InterruptTriggerId,
} from '@/lib/trading-terminal/coach-interrupt'
import { scanToVerdictCard } from '@/lib/trading-terminal/map-verdict'
import { appendTrade } from '@/lib/trading-terminal/trade-log'
import { CoachInterruptBanner } from './CoachInterruptBanner'
import { SniperArmPanel } from './SniperArmPanel'
import { useTerminalFocus } from './TerminalFocusProvider'

export function ExecutionTicket() {
  const {
    focusMint,
    focusSymbol,
    ticketSide,
    setTicketSide,
    scan,
    portfolioTotalUsd,
    positionValueUsd,
  } = useTerminalFocus()

  const [muted, setMuted] = useState(() => loadMutes())
  const [overridden, setOverridden] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Reset override when focus or side changes
  useEffect(() => {
    setOverridden(false)
    setDismissed(false)
  }, [focusMint, ticketSide, scan?.scannedAt])

  const concentrationPct = useMemo(() => {
    if (!focusMint || portfolioTotalUsd <= 0) return null
    const v = positionValueUsd(focusMint)
    if (v == null || v <= 0) return null
    return (v / portfolioTotalUsd) * 100
  }, [focusMint, portfolioTotalUsd, positionValueUsd])

  const interrupts = useMemo(
    () =>
      evaluateCoachInterrupts({
        scan,
        ticketSide,
        positionConcentrationPct: concentrationPct,
        muted,
      }),
    [scan, ticketSide, concentrationPct, muted],
  )

  const hard = hasHardBlock(interrupts)
  const softPending = hasSoftGate(interrupts) && !overridden && !dismissed
  const card = scanToVerdictCard(scan)

  const logAction = (action: 'overridden' | 'muted' | 'dismissed', triggerIds?: InterruptTriggerId[]) => {
    appendOverrideLog({
      at: new Date().toISOString(),
      mint: focusMint,
      side: ticketSide,
      triggers: triggerIds ?? interrupts.map((i) => i.id),
      action,
      verdict: card?.verdict ?? null,
    })
  }

  const onOverride = () => {
    if (hard) return
    setOverridden(true)
    logAction('overridden')
  }

  const onMute = (id: InterruptTriggerId) => {
    if (id === 'blocked') return
    saveMute(id)
    setMuted(loadMutes())
    logAction('muted', [id])
  }

  const onDismissSoft = () => {
    setDismissed(true)
    logAction('dismissed')
  }

  // Keyboard O = override soft gate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.key === 'o' || e.key === 'O') && !e.metaKey && !e.ctrlKey) {
        if (softPending && !hard) {
          e.preventDefault()
          onOverride()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onOverride closes over latest
  }, [softPending, hard, focusMint, ticketSide, interrupts])

  const buy = ticketSide === 'buy'
  const from = buy ? SOL_MINT : focusMint
  const to = buy ? focusMint : SOL_MINT
  const showSwap = focusMint.length >= 32 && (!softPending || hard)

  return (
    <section className="tit-panel flex flex-col overflow-hidden" aria-label="Execution ticket">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        <p className="tit-label">Ticket</p>
        <span className="tit-mono truncate text-[0.65rem] text-[var(--tit-text-1)]">
          {focusSymbol || '—'} {focusMint ? `· ${focusMint.slice(0, 4)}…` : ''}
        </span>
        {scan?.verdict ? (
          <span className="tit-mono ml-auto text-[0.6rem] uppercase text-[var(--tit-text-2)]">
            {scan.verdict}
          </span>
        ) : null}
      </div>

      <div className="flex gap-1 px-3 pt-2">
        <button
          type="button"
          onClick={() => setTicketSide('buy')}
          className={`flex-1 rounded py-1.5 text-xs font-semibold ${
            buy
              ? 'bg-[var(--tit-pos)]/20 text-[var(--tit-pos)]'
              : 'bg-[var(--tit-bg-2)] text-[var(--tit-text-2)]'
          }`}
        >
          Buy (B)
        </button>
        <button
          type="button"
          onClick={() => setTicketSide('sell')}
          className={`flex-1 rounded py-1.5 text-xs font-semibold ${
            !buy
              ? 'bg-[var(--tit-neg)]/20 text-[var(--tit-neg)]'
              : 'bg-[var(--tit-bg-2)] text-[var(--tit-text-2)]'
          }`}
        >
          Sell (S)
        </button>
      </div>

      {interrupts.length > 0 ? (
        <CoachInterruptBanner
          interrupts={interrupts}
          overridden={overridden}
          onOverride={onOverride}
          onMute={onMute}
          onDismissSoft={onDismissSoft}
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {focusMint.length < 32 ? (
          <p className="px-1 py-3 text-xs text-[var(--tit-text-1)]">
            Focus a token to arm the ticket
          </p>
        ) : softPending ? (
          <p className="px-1 py-3 text-xs text-[var(--tit-warn)]">
            Ticket gated by coach interrupt. Press O to override (logged) or mute for 24h.
          </p>
        ) : showSwap ? (
          <RiskGatedSwapPanel
            key={`${ticketSide}:${focusMint}:${overridden ? 'o' : 'n'}`}
            defaultFromToken={from}
            defaultToToken={to}
            onSwapComplete={(result) => {
              const c = scanToVerdictCard(scan)
              void (async () => {
                const { fetchMarkPrice } = await import('@/lib/trading-terminal/mark-price')
                const mark = await fetchMarkPrice(focusMint)
                appendTrade({
                  at: new Date().toISOString(),
                  mint: focusMint,
                  symbol: focusSymbol || c?.mint.slice(0, 6) || focusMint.slice(0, 6),
                  side: ticketSide,
                  signature: result.signature,
                  entryPriceUsd: mark?.priceUsd,
                  verdictAtTrade: c?.verdict ?? null,
                  coachOverridden: overridden,
                })
              })()
            }}
          />
        ) : null}
      </div>

      {focusMint.length >= 32 ? <SniperArmPanel /> : null}

      <p className="tit-compliance border-t border-white/[0.06] px-3 py-2">
        {COMPLIANCE_DISCLAIMER}{' '}
        <Link href={TERMS_PATH} className="underline hover:text-[var(--tit-text-1)]">
          Terms
        </Link>
        {' · '}
        <Link href={FEE_DISCLOSURE_PATH} className="underline hover:text-[var(--tit-text-1)]">
          Fees
        </Link>
      </p>
    </section>
  )
}
