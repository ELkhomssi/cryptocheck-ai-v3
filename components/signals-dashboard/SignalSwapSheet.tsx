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
import { getPlatformFeeAccount, isPlatformFeeConfigured } from '@/lib/trading/platform-fee-config'
import type { SwapDecision } from '@/lib/trading/risk-gated-swap'
import { simulateSerializedSwapTransaction } from '@/lib/services/swap-simulation'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

type Props = {
  signal: UnifiedSignal | null
  open: boolean
  onClose: () => void
}

export function SignalSwapSheet({ signal, open, onClose }: Props) {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [amountUsd, setAmountUsd] = useState(50)
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

    setSwapping(true)
    setError(null)
    try {
      const swapTxBase64 = await buildJupiterSwapTransaction(
        quote.quote,
        wallet.publicKey.toBase58(),
        isPlatformFeeConfigured() ? { feeAccount: getPlatformFeeAccount() } : undefined,
      )
      const sim = await simulateSerializedSwapTransaction(connection, swapTxBase64)
      if (sim.sellSimulationFailed) {
        throw new Error(sim.rpcError ?? 'Simulation failed')
      }

      const tx = VersionedTransaction.deserialize(Buffer.from(swapTxBase64, 'base64'))
      const signed = await wallet.signTransaction(tx)
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false })
      await connection.confirmTransaction(sig, 'confirmed')
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
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Swap failed')
    } finally {
      setSwapping(false)
    }
  }

  if (!open || !tokenSignal) return null

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
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <p className="rd-label">Safe swap · Jupiter</p>
            <h2 id="swap-sheet-title" className="font-rd-display text-lg font-bold uppercase text-rd-hi">
              {tokenSignal?.tokenSymbol ?? tokenSignal?.label}
            </h2>
            <p className="mt-1 font-rd-mono text-xs text-rd-lo">{mint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-rd-sm p-2 text-rd-mid hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
            aria-label="Close swap sheet"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mini chart — DexScreener embed (read-only). Swap still uses Jupiter risk-gated path below. */}
        {mint.length >= 32 ? (
          <div className="mb-4 overflow-hidden rounded-rd-sm border border-white/10 bg-black/40">
            <div className="flex items-center justify-between border-b border-white/10 px-2 py-1">
              <span className="font-rd-mono text-[0.55rem] uppercase tracking-wider text-rd-lo">Chart</span>
              <a
                href={`https://dexscreener.com/solana/${mint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-rd-mono text-[0.55rem] text-rd-mid hover:text-rd-hi"
              >
                DexScreener ↗
              </a>
            </div>
            <iframe
              title={`${tokenSignal?.tokenSymbol ?? 'Token'} chart`}
              src={`https://dexscreener.com/solana/${mint}?embed=1&theme=dark&trades=0&info=0`}
              className="h-[180px] w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              loading="lazy"
            />
          </div>
        ) : null}

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
          <div className="mt-4 space-y-2 rounded-rd-sm border border-white/10 bg-rd-navy/80 p-3 text-sm">
            <div className="flex justify-between text-rd-mid">
              <span>Platform fee</span>
              <span className="font-rd-mono tabular-nums text-rd-hi">
                {quote.platformFee.bps / 100}% · {quote.platformFee.amountUsd != null ? `$${quote.platformFee.amountUsd.toFixed(4)}` : quote.platformFee.amountBase}
              </span>
            </div>
            <div className="flex justify-between text-rd-mid">
              <span>Price impact</span>
              <span className="font-rd-mono tabular-nums text-rd-hi">{quote.priceImpactPct.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-rd-mid">
              <span>Slippage</span>
              <span className="font-rd-mono tabular-nums text-rd-hi">{quote.slippageBps} bps</span>
            </div>
          </div>
        ) : null}

        {decision?.warnings?.length ? (
          <ul className="mt-3 space-y-1 text-xs text-rd-caution">
            {decision.warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
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
            disabled={!quote || swapping || !wallet.connected}
            onClick={() => void executeSwap()}
            className="flex-1 rounded-rd-sm bg-rd-green px-4 py-2.5 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider text-rd-navy disabled:opacity-50"
          >
            {swapping ? 'Signing…' : 'Jupiter · Simulate & swap'}
          </button>
        </div>

        <div className="mt-4">
          <RevenueComplianceNote />
        </div>
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
