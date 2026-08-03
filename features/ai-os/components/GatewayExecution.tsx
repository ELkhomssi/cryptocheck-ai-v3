'use client'

/**
 * Gateway execution — last step after Approve.
 * Reuses Jupiter risk-gated quote/assess + OMS prepare path.
 * Non-custodial: wallet signs; simulate before send.
 */

import { useCallback, useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { VersionedTransaction } from '@solana/web3.js'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import { useIntelligenceChart } from '@/features/intelligence-chart/hooks/useIntelligenceChart'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { buildJupiterSwapTransaction } from '@/lib/trading/jupiter-client'
import { simulateSerializedSwapTransaction } from '@/lib/services/swap-simulation'
import { sendSignedSwap } from '@/lib/execution/client-submit'
import type { SwapQuote } from '@/lib/revenue-dashboard/types'
import type { SwapDecision } from '@/lib/trading/risk-gated-swap'
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/revenue-dashboard/constants'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const HIGH_RISK_PHRASE = 'I UNDERSTAND THE RISK'

export function GatewayExecution() {
  const { state } = useTradeLikeMeEngine()
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const wallet = useWallet()
  const { connection } = useConnection()
  const opp = state.currentOpportunity

  const chartQuery =
    (focused?.id && focused.id.length >= 32 ? focused.id : null) ||
    focused?.symbol ||
    opp?.tokenSymbol ||
    'SOL'
  const { data: bundle } = useIntelligenceChart(
    chartQuery,
    opp?.chain === 'all' ? 'solana' : opp?.chain || focused?.chain || 'solana',
  )

  const mint =
    (focused?.id && focused.id.length >= 32 ? focused.id : '') ||
    (bundle?.token.id && bundle.token.id.length >= 32 ? bundle.token.id : '')

  const price = bundle?.token.priceUsd ?? 0
  const solUsd =
    bundle?.token.symbol?.toUpperCase() === 'SOL' && price > 0 ? price : 150

  const [amountUsd, setAmountUsd] = useState(50)
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [decision, setDecision] = useState<SwapDecision | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sig, setSig] = useState<string | null>(null)
  const [highRiskTyped, setHighRiskTyped] = useState('')
  const highRiskAck = highRiskTyped.trim() === HIGH_RISK_PHRASE

  const refresh = useCallback(async () => {
    if (!mint || mint.length < 32 || !(amountUsd > 0)) {
      setQuote(null)
      setDecision(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const amountSol = amountUsd / solUsd
      const [qRes, aRes] = await Promise.all([
        fetch('/api/revenue/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputMint: SOL_MINT,
            outputMint: mint,
            amount: amountSol,
            slippageBps: DEFAULT_SLIPPAGE_BPS,
          }),
        }),
        fetch('/api/revenue/assess-swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromToken: SOL_MINT,
            toToken: mint,
            amountUsd,
            slippageBps: DEFAULT_SLIPPAGE_BPS,
            walletAddress: wallet.publicKey?.toBase58(),
          }),
        }),
      ])
      const qBody = await qRes.json()
      if (!qRes.ok) throw new Error(qBody.error ?? 'Quote failed')
      setQuote(qBody as SwapQuote)
      if (aRes.ok) setDecision((await aRes.json()) as SwapDecision)
      else setDecision(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quote failed')
      setQuote(null)
      setDecision(null)
    } finally {
      setBusy(false)
    }
  }, [mint, amountUsd, solUsd, wallet.publicKey])

  useEffect(() => {
    const t = window.setTimeout(() => void refresh(), 400)
    return () => window.clearTimeout(t)
  }, [refresh])

  const execute = async () => {
    if (!quote || !wallet.publicKey || !wallet.signTransaction) return
    if (decision?.verdict === 'BLOCKED') {
      setError(decision.blockedReason ?? 'Blocked by Security Scanner')
      return
    }
    if (decision?.verdict === 'HIGH_RISK' && !highRiskAck) {
      setError(`High risk — type "${HIGH_RISK_PHRASE}" below to continue.`)
      return
    }
    setBusy(true)
    setError(null)
    setStatus('Simulating…')
    try {
      const amountSol = amountUsd / solUsd
      let swapTxBase64: string | null = null
      let opportunityId: string | null = null

      const prepRes = await fetch('/api/execution/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint,
          walletAddress: wallet.publicKey.toBase58(),
          amountSol,
          slippageBps: DEFAULT_SLIPPAGE_BPS,
          strategy: 'balanced',
          source: 'manual',
          symbol: focused?.symbol || opp?.tokenSymbol,
        }),
      })
      const prepBody = (await prepRes.json().catch(() => ({}))) as {
        allowed?: boolean
        swapTransaction?: string
        opportunityId?: string
        blockReason?: string
        error?: string
      }

      if (prepRes.status === 401) {
        swapTxBase64 = await buildJupiterSwapTransaction(
          quote.quote,
          wallet.publicKey.toBase58(),
          {},
        )
        const sim = await simulateSerializedSwapTransaction(connection, swapTxBase64)
        if (sim.sellSimulationFailed) {
          setError('Simulation would revert — not sent to wallet.')
          setStatus(null)
          return
        }
      } else if (!prepRes.ok || !prepBody.allowed || !prepBody.swapTransaction) {
        setError(
          prepBody.blockReason || prepBody.error || 'OMS prepare blocked — not sent.',
        )
        setStatus(null)
        return
      } else {
        opportunityId = prepBody.opportunityId ?? null
        swapTxBase64 = String(prepBody.swapTransaction)
      }

      if (!swapTxBase64) throw new Error('No unsigned transaction')
      setStatus('Approve in your wallet…')
      const tx = VersionedTransaction.deserialize(Buffer.from(swapTxBase64, 'base64'))
      const signed = await wallet.signTransaction(tx)
      setStatus('Broadcasting…')
      const sent = await sendSignedSwap({
        signed,
        connection,
        strategy: 'balanced',
        opportunityId,
      })
      setSig(sent.signature)
      setStatus('Confirmed — check explorer if needed.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Execution failed'
      if (/reject|cancel/i.test(msg)) setError('Wallet rejected the signature request.')
      else setError(msg)
      setStatus(null)
    } finally {
      setBusy(false)
    }
  }

  const symbol = focused?.symbol || opp?.tokenSymbol || bundle?.token.symbol || 'Token'
  const fee = quote?.platformFee?.amountUsd

  if (!mint || mint.length < 32) {
    return (
      <p className="aios-muted">
        Waiting for a resolvable mint for ${symbol}. Refresh the recommendation or focus a token.
      </p>
    )
  }

  return (
    <div className="aios-exec">
      <p className="aios-exec-pair">
        Buy ${symbol} · Security {decision?.verdict ?? '…'}
      </p>
      <label className="aios-field">
        <span>Amount (USD)</span>
        <input
          type="number"
          min={1}
          className="aios-input"
          value={amountUsd}
          onChange={(e) => setAmountUsd(Number(e.target.value))}
        />
      </label>
      {fee != null ? (
        <p className="aios-muted">Platform fee ${fee.toFixed(4)} · slippage {DEFAULT_SLIPPAGE_BPS / 100}%</p>
      ) : null}
      {decision?.verdict === 'CAUTION' ? (
        <p className="aios-warn">Caution — review scanner warnings before signing.</p>
      ) : null}
      {decision?.verdict === 'HIGH_RISK' ? (
        <label className="aios-field">
          <span>High risk — type {HIGH_RISK_PHRASE}</span>
          <input
            className="aios-input"
            value={highRiskTyped}
            onChange={(e) => setHighRiskTyped(e.target.value)}
            autoComplete="off"
          />
        </label>
      ) : null}
      {decision?.verdict === 'BLOCKED' ? (
        <p className="aios-warn">Blocked by Security Scanner — execution disabled.</p>
      ) : null}
      {status ? <p className="aios-status">{status}</p> : null}
      {error ? <p className="aios-warn">{error}</p> : null}
      {sig ? (
        <p className="aios-status">
          Signature {sig.slice(0, 8)}…{sig.slice(-6)}
        </p>
      ) : null}
      <button
        type="button"
        className="aios-btn aios-btn-primary"
        disabled={
          busy ||
          !quote ||
          !wallet.publicKey ||
          decision?.verdict === 'BLOCKED' ||
          (decision?.verdict === 'HIGH_RISK' && !highRiskAck)
        }
        onClick={() => void execute()}
      >
        {busy ? 'Working…' : 'Sign & execute'}
      </button>
      <p className="aios-compliance">Not financial advice · DYOR</p>
    </div>
  )
}
