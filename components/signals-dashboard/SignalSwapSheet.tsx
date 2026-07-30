'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { VersionedTransaction } from '@solana/web3.js'
import { Loader2, X } from 'lucide-react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { DangerAcknowledgeModal } from '@/components/revenue-dashboard/DangerAcknowledgeModal'
import { RevenueComplianceNote } from '@/components/revenue-dashboard/RevenueComplianceNote'
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/revenue-dashboard/constants'
import { SIGNAL_AMOUNT_PRESETS_USD } from '@/lib/signal-aggregator/constants'
import type { SwapQuote } from '@/lib/revenue-dashboard/types'
import { isQuoteExpired } from '@/lib/revenue-dashboard/swap-quote'
import { buildJupiterSwapTransaction } from '@/lib/trading/jupiter-client'
import type { SwapDecision } from '@/lib/trading/risk-gated-swap'
import { simulateSerializedSwapTransaction } from '@/lib/services/swap-simulation'
import { PlatformFeeConfirmRows } from '@/components/launchpad/PlatformFeeConfirmRows'
import { computePlatformFeeDisclosure } from '@/lib/launchpad/platform-fee'
import { sendSignedSwap } from '@/lib/execution/client-submit'
import { IntelligenceChart } from '@/features/intelligence-chart'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

type ExecStrategy = 'aggressive' | 'balanced' | 'conservative' | 'smart_entry'

const STRATEGIES: { id: ExecStrategy; label: string }[] = [
  { id: 'conservative', label: 'Safe' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'aggressive', label: 'Fast' },
  { id: 'smart_entry', label: 'Smart' },
]

type Props = {
  signal: UnifiedSignal | null
  open: boolean
  onClose: () => void
  /** Inline = Action Panel body (no modal). Sheet = legacy overlay. */
  variant?: 'sheet' | 'inline'
}

export function SignalSwapSheet({ signal, open, onClose, variant = 'sheet' }: Props) {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [amountUsd, setAmountUsd] = useState(50)
  const [strategy, setStrategy] = useState<ExecStrategy>('balanced')
  const [omsNote, setOmsNote] = useState<string | null>(null)
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [decision, setDecision] = useState<SwapDecision | null>(null)
  const [dangerOpen, setDangerOpen] = useState(false)
  const [dangerTyped, setDangerTyped] = useState('')
  const [dangerOk, setDangerOk] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)

  const tokenSignal =
    signal?.subjectType === 'token' ? signal : null
  const mint = tokenSignal?.contractAddress ?? ''
  const isDanger = tokenSignal?.verdict === 'danger'

  const loadQuote = useCallback(async () => {
    if (!signal || mint.length < 32) return
    setQuoteLoading(true)
    setError(null)
    try {
      const solPrice = 150
      const solAmount = amountUsd / solPrice
      const res = await fetch('/api/revenue/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint: SOL_MINT,
          outputMint: mint,
          amount: solAmount,
          slippageBps: DEFAULT_SLIPPAGE_BPS,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Quote failed')
      setQuote(body as SwapQuote)

      const assessRes = await fetch('/api/revenue/assess-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromToken: SOL_MINT,
          toToken: mint,
          amountUsd,
          slippageBps: DEFAULT_SLIPPAGE_BPS,
          walletAddress: wallet.publicKey?.toBase58(),
        }),
      })
      const decisionBody = (await assessRes.json()) as SwapDecision & { error?: string }
      if (assessRes.ok) setDecision(decisionBody)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quote failed')
      setQuote(null)
    } finally {
      setQuoteLoading(false)
    }
  }, [signal, mint, amountUsd, wallet.publicKey])

  useEffect(() => {
    if (!open || !signal) return
    setSignature(null)
    setDangerOk(false)
    setDangerTyped('')
    setOmsNote(null)
    void loadQuote()
  }, [open, signal, loadQuote])

  const executeSwap = async () => {
    if (!quote || !wallet.publicKey || !wallet.signTransaction) return
    if (isQuoteExpired(quote)) {
      setError('Quote expired — refresh and try again.')
      return
    }
    if (isDanger && !dangerOk) {
      setDangerOpen(true)
      return
    }
    if (decision && !decision.allowed) {
      setError(decision.blockedReason ?? 'Swap blocked by risk policy')
      return
    }

    setSwapping(true)
    setError(null)
    setOmsNote(null)
    try {
      const solPrice = 150
      const amountSol = amountUsd / solPrice
      let swapTxBase64: string | null = null
      let opportunityId: string | null = null
      let usedOms = false

      const prepRes = await fetch('/api/execution/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint,
          walletAddress: wallet.publicKey.toBase58(),
          amountSol,
          slippageBps: quote.slippageBps || DEFAULT_SLIPPAGE_BPS,
          strategy,
          source: signal?.sourceTag === 'launchpad' ? 'launchlab' : 'smart_alpha',
          symbol: tokenSignal?.tokenSymbol,
          clientRequestId: signal?.id,
        }),
      })
      const prepBody = await prepRes.json().catch(() => ({}))

      if (prepRes.status === 401) {
        const feeAcct = quote.platformFee.feeTokenAccount?.trim()
        swapTxBase64 = await buildJupiterSwapTransaction(
          quote.quote,
          wallet.publicKey.toBase58(),
          feeAcct && quote.platformFee.bps > 0 ? { feeAccount: feeAcct } : undefined,
        )
        const sim = await simulateSerializedSwapTransaction(connection, swapTxBase64)
        if (sim.sellSimulationFailed) {
          throw new Error(sim.rpcError ?? 'Simulation failed')
        }
      } else if (!prepRes.ok || !prepBody?.allowed || !prepBody?.swapTransaction) {
        throw new Error(
          typeof prepBody?.blockReason === 'string'
            ? prepBody.blockReason
            : typeof prepBody?.error === 'string'
              ? prepBody.error
              : 'OMS prepare blocked',
        )
      } else {
        usedOms = true
        opportunityId = typeof prepBody.opportunityId === 'string' ? prepBody.opportunityId : null
        swapTxBase64 = String(prepBody.swapTransaction)
        const safety = prepBody.safety?.score
        const simConf = prepBody.simulation?.confidence
        setOmsNote(
          [
            strategy,
            typeof safety === 'number' ? `safety ${safety}` : null,
            typeof simConf === 'number' ? `sim ${(simConf * 100).toFixed(0)}%` : null,
          ]
            .filter(Boolean)
            .join(' · '),
        )
      }

      if (!swapTxBase64) throw new Error('No swap transaction')

      const tx = VersionedTransaction.deserialize(Buffer.from(swapTxBase64, 'base64'))
      const signed = await wallet.signTransaction(tx)
      const sent = await sendSignedSwap({
        signed,
        connection,
        strategy,
        opportunityId,
      })
      const sig = sent.signature
      setSignature(sig)

      await fetch('/api/revenue/record-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: sig,
          walletAddress: wallet.publicKey.toBase58(),
          inputMint: SOL_MINT,
          outputMint: mint,
          volumeUsd: amountUsd,
          feeBps: quote.platformFee.bps,
          feeAmountBase: quote.platformFee.amountBase,
          feeAmountUsd: quote.platformFee.amountUsd,
          feeTokenAccount: quote.platformFee.feeTokenAccount,
          signalId: signal?.id,
        }),
      }).catch(() => undefined)

      if (usedOms && opportunityId) {
        await fetch('/api/execution/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opportunityId,
            mint,
            walletAddress: wallet.publicKey.toBase58(),
            txSignature: sig,
            amountSol,
          }),
        }).catch(() => undefined)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Swap failed')
    } finally {
      setSwapping(false)
    }
  }

  if (!open || !tokenSignal) return null

  const body = (
        <div className={variant === 'inline' ? 'max-h-[70vh] overflow-y-auto' : undefined}>
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <p className="rd-label">Risk-gated swap · OMS</p>
            <h2 id="swap-sheet-title" className="font-rd-display text-lg font-bold uppercase text-rd-hi">
              {tokenSignal?.tokenSymbol ?? tokenSignal?.label}
            </h2>
            <p className="mt-1 font-rd-mono text-xs text-rd-lo">{mint}</p>
          </div>
          {variant === 'sheet' ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-rd-sm p-2 text-rd-mid hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
            aria-label="Close swap sheet"
          >
            <X className="h-5 w-5" />
          </button>
          ) : null}
        </div>

        {mint.length >= 32 ? (
          <div className="ic-root mb-4 overflow-hidden rounded-rd-sm border border-white/10 bg-black/40 p-1">
            <IntelligenceChart query={mint} chain="solana" />
          </div>
        ) : null}


        <div className="mb-3">
          <p className="mb-1.5 font-rd-mono text-[0.55rem] uppercase tracking-wider text-rd-lo">
            Execution strategy
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStrategy(s.id)}
                className={`rounded-rd-sm px-2.5 py-1 text-[11px] font-semibold ${
                  strategy === s.id
                    ? 'bg-rd-green text-rd-navy'
                    : 'border border-white/15 text-rd-mid hover:text-rd-hi'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {SIGNAL_AMOUNT_PRESETS_USD.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmountUsd(n)}
              className={`rounded-rd-sm px-3 py-1.5 font-rd-mono text-sm tabular-nums ${
                amountUsd === n ? 'bg-rd-green text-rd-navy' : 'border border-white/15 text-rd-mid'
              }`}
            >
              ${n}
            </button>
          ))}
        </div>

        {quoteLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-rd-mid">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
            Fetching quote…
          </div>
        ) : null}

        {quote ? (
          <PlatformFeeConfirmRows
            fee={computePlatformFeeDisclosure({
              feeBps: quote.platformFee.bps,
              feeAccount: quote.platformFee.feeTokenAccount || null,
              feeAmountBase: quote.platformFee.amountBase,
              outAmountBase: quote.outputAmountBase,
              inAmountBase: quote.inputAmountBase,
              inputMint: quote.inputMint,
              outputMint: quote.outputMint,
              solUsd:
                quote.platformFee.amountUsd != null && quote.platformFee.bps > 0
                  ? (quote.platformFee.amountUsd * 10000) / quote.platformFee.bps /
                    (Number(quote.inputAmountBase) / 1e9 || 1)
                  : undefined,
            })}
            slippageBps={quote.slippageBps}
            priceImpactPct={quote.priceImpactPct}
            routeLabel={quote.routeLabel}
          />
        ) : null}

        {decision?.warnings?.length ? (
          <ul className="mt-3 space-y-1 text-xs text-rd-caution">
            {decision.warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        ) : null}

        {omsNote ? (
          <p className="mt-2 font-rd-mono text-[10px] text-rd-mid">OMS · {omsNote}</p>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-rd-danger" role="alert">
            {error}
          </p>
        ) : null}

        {signature ? (
          <p className="mt-3 font-rd-mono text-xs text-rd-safe">Confirmed: {signature.slice(0, 16)}…</p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void loadQuote()}
            className="flex-1 rounded-rd-sm border border-white/15 px-4 py-2.5 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider text-rd-mid"
          >
            Refresh quote
          </button>
          <button
            type="button"
            disabled={!quote || swapping || !wallet.connected || (decision != null && !decision.allowed)}
            onClick={() => void executeSwap()}
            className="flex-1 rounded-rd-sm bg-rd-green px-4 py-2.5 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider text-rd-navy disabled:opacity-50"
          >
            {swapping ? 'Preparing…' : 'Simulate & swap'}
          </button>
        </div>

        <div className="mt-4">
          <RevenueComplianceNote />
        </div>
        </div>
  )

  if (variant === 'inline') {
    return (
      <>
        <div className="rounded-dash-inner border border-dash-innerline bg-dash-panel2 p-3 text-dash-thi [&_.rd-label]:text-dash-tlo [&_.text-rd-hi]:text-dash-thi [&_.text-rd-mid]:text-dash-tmid [&_.text-rd-lo]:text-dash-tlo [&_.bg-rd-green]:bg-dash-green [&_.text-rd-navy]:text-dash-bg">
          {body}
        </div>
        <DangerAcknowledgeModal
          open={dangerOpen}
          typed={dangerTyped}
          onTypedChange={setDangerTyped}
          onConfirm={() => {
            setDangerOk(true)
            setDangerOpen(false)
          }}
          onClose={() => setDangerOpen(false)}
        />
      </>
    )
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
        role="presentation"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[95] max-h-[92vh] overflow-y-auto rounded-t-rd-lg border border-white/10 bg-rd-navy2 p-4 shadow-2xl md:inset-x-auto md:left-1/2 md:top-1/2 md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-rd-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-sheet-title"
      >
        {body}
      </div>

      <DangerAcknowledgeModal
        open={dangerOpen}
        typed={dangerTyped}
        onTypedChange={setDangerTyped}
        onConfirm={() => {
          setDangerOk(true)
          setDangerOpen(false)
        }}
        onClose={() => setDangerOpen(false)}
      />
    </>
  )
}
