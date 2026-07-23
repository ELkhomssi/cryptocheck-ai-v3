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
    ticketAmountSol,
    setTicketAmountSol,
  } = useTerminalFocus()

  const [muted, setMuted] = useState(() => loadMutes())
  const [overridden, setOverridden] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'DCA'>('MARKET')
  const [reviewOpen, setReviewOpen] = useState(false)

  // Reset override when focus or side changes
  useEffect(() => {
    setOverridden(false)
    setDismissed(false)
    setReviewOpen(false)
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
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[rgba(5,7,10,0.35)]"
      aria-label="Execution ticket"
    >
      <div className="flex items-center gap-2 border-b border-[var(--tit-border)] px-4 py-2.5">
        <p className="tit-section-title">Ticket</p>
        <span className="tit-mono truncate text-[0.68rem] text-[var(--tit-text-1)]">
          {focusSymbol || '—'} {focusMint ? `· ${focusMint.slice(0, 4)}…` : ''}
        </span>
        {scan?.verdict ? (
          <span className="tit-mono ml-auto rounded-md border border-[var(--tit-border)] px-1.5 py-0.5 text-[0.58rem] uppercase text-[var(--tit-text-2)]">
            {scan.verdict}
          </span>
        ) : null}
      </div>

      <div className="flex gap-1.5 px-4 pt-3">
        <button
          type="button"
          onClick={() => setTicketSide('buy')}
          className={`flex-1 rounded-[8px] py-2 text-xs font-semibold tracking-wide transition-all duration-[var(--tit-motion)] ${
            buy
              ? 'bg-[var(--tit-pos)] text-white'
              : 'bg-[var(--tit-bg-2)] text-[var(--tit-text-2)] hover:text-[var(--tit-text-0)]'
          }`}
        >
          BUY
        </button>
        <button
          type="button"
          onClick={() => setTicketSide('sell')}
          className={`flex-1 rounded-[8px] py-2 text-xs font-semibold tracking-wide transition-all duration-[var(--tit-motion)] ${
            !buy
              ? 'bg-[var(--tit-neg)] text-white'
              : 'bg-[var(--tit-bg-2)] text-[var(--tit-text-2)] hover:text-[var(--tit-text-0)]'
          }`}
        >
          SELL
        </button>
      </div>

      <div className="flex gap-1 px-4 pt-2">
        {(['MARKET', 'LIMIT', 'DCA'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setOrderType(t)}
            className={`tit-mono flex-1 rounded-md py-1.5 text-[0.58rem] font-bold transition-colors ${
              orderType === t
                ? 'bg-[var(--tit-accent)]/15 text-[var(--tit-accent-bright)] ring-1 ring-[var(--tit-accent)]/30'
                : 'bg-[var(--tit-bg-2)] text-[var(--tit-text-2)] hover:text-[var(--tit-text-1)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-4 pt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="tit-label" htmlFor="tit-ticket-amt">
            Amount (SOL)
          </label>
          <span className="tit-mono text-[0.55rem] text-[var(--tit-text-2)]">Slippage 1.0%</span>
        </div>
        <input
          id="tit-ticket-amt"
          type="number"
          min={0}
          step={0.05}
          value={ticketAmountSol}
          onChange={(e) => setTicketAmountSol(Number(e.target.value) || 0)}
          className="tit-input tit-mono w-full"
        />
        <div className="mt-1.5 flex gap-1">
          {[
            { label: '25%', n: 0.25 },
            { label: '50%', n: 0.5 },
            { label: '75%', n: 1 },
            { label: 'MAX', n: 2 },
          ].map((x) => (
            <button
              key={x.label}
              type="button"
              onClick={() => setTicketAmountSol(x.n)}
              className="tit-mono flex-1 rounded-md border border-[var(--tit-border)] py-1 text-[0.55rem] text-[var(--tit-text-1)] transition-colors hover:border-[var(--tit-accent)] hover:text-[var(--tit-accent-bright)]"
            >
              {x.label}
            </button>
          ))}
        </div>
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

      <div className="px-3 pt-2">
        <button
          type="button"
          disabled={focusMint.length < 32 || softPending}
          onClick={() => setReviewOpen(true)}
          className="tit-btn-accent w-full py-2 text-[0.75rem] disabled:opacity-40"
        >
          REVIEW ORDER
        </button>
        {orderType !== 'MARKET' ? (
          <p className="mt-1 text-center text-[0.5rem] text-[var(--tit-text-2)]">
            {orderType} routed via market ticket until limit/DCA engine ships.
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {focusMint.length < 32 ? (
          <p className="px-1 py-3 text-xs text-[var(--tit-text-1)]">
            Select a symbol to arm the ticket.
          </p>
        ) : softPending ? (
          <p className="px-1 py-3 text-xs text-[var(--tit-warn)]">
            Ticket gated by coach interrupt. Press O to override (logged) or mute for 24h.
          </p>
        ) : reviewOpen && showSwap ? (
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
        ) : reviewOpen ? null : (
          <p className="px-1 py-2 text-center text-[0.65rem] text-[var(--tit-text-2)]">
            Review to open the risk-gated swap path.
          </p>
        )}
      </div>

      <p className="tit-compliance border-t border-[var(--tit-border)] px-3 py-2">
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
