'use client'

/**
 * Simple Mode Execution — one recommendation, real cost, real ExecutionState.
 * Reuses Jupiter / OMS / wallet-sign path. Never disguises the wallet prompt.
 * Pro Mode SecureExecutionPanel is not edited; this is a Simple-only surface.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { VersionedTransaction } from '@solana/web3.js'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import { useIntelligenceChart } from '@/features/intelligence-chart/hooks/useIntelligenceChart'
import {
  computeBuilderState,
  defaultSlippageBpsFromLiquidity,
} from '@/features/execution-desk/lib/builder-math'
import { computeMevProtection } from '@/features/execution-desk/lib/mev-score'
import type { ExecutionBuilderState, ExecutionState } from '@/features/execution-desk/types'
import { buildJupiterSwapTransaction } from '@/lib/trading/jupiter-client'
import type { SwapDecision } from '@/lib/trading/risk-gated-swap'
import type { SwapQuote } from '@/lib/revenue-dashboard/types'
import { simulateSerializedSwapTransaction } from '@/lib/services/swap-simulation'
import { sendSignedSwap } from '@/lib/execution/client-submit'
import { useExecutionLifecycleBridge } from '@/features/terminal-os/money-lifecycle/execution-lifecycle-bridge'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { SimpleSecureAccount } from '../components/SimpleSecureAccount'
import { SIMPLE_VOCAB } from '../lib/vocab'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

function stateMessage(s: ExecutionState): string {
  switch (s) {
    case 'building':
      return 'Preparing estimate…'
    case 'simulating':
      return 'Simulating — nothing signed yet'
    case 'awaiting_signature':
      return 'Approve in your wallet extension (real Phantom / Solflare prompt)'
    case 'broadcasting':
      return 'Broadcasting to the network…'
    case 'pending_confirmation':
      return 'Waiting for on-chain confirmation…'
    case 'confirmed':
      return 'Confirmed on-chain'
    case 'simulation_failed':
      return 'Simulation failed — not sent'
    case 'failed':
      return 'Execution failed'
    case 'reverted':
      return 'Transaction reverted'
    default:
      return s
  }
}

export function SimpleExecutionWorkspace() {
  const { state } = useTradeLikeMeEngine()
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const wallet = useWallet()
  const { connection } = useConnection()
  const publishExec = useExecutionLifecycleBridge((s) => s.setExecutionState)
  const publishSig = useExecutionLifecycleBridge((s) => s.setLastSignature)

  const opp = state.currentOpportunity
  const narrative = opp ? explainDecision(opp) : null
  const focused = useTerminalOsStore((s) => s.focusedToken)
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
  const liq = bundle?.token.liquidityUsd ?? 0
  const solUsd =
    bundle?.token.symbol?.toUpperCase() === 'SOL' && price > 0 ? price : 150

  const [amountUsd, setAmountUsd] = useState(50)
  const [slippageBps, setSlippageBps] = useState(100)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showCostDetails, setShowCostDetails] = useState(false)
  const [gasUsd, setGasUsd] = useState(0.02)
  const [priorityUsd, setPriorityUsd] = useState(0.01)
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [decision, setDecision] = useState<SwapDecision | null>(null)
  const [execState, setExecState] = useState<ExecutionState>('building')
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)

  useEffect(() => {
    if (liq > 0) setSlippageBps(defaultSlippageBpsFromLiquidity(liq))
  }, [liq])

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const fees = await connection.getRecentPrioritizationFees()
        const sorted = fees
          .map((f) => f.prioritizationFee)
          .filter((n) => Number.isFinite(n) && n >= 0)
          .sort((a, b) => a - b)
        const mid = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 5_000
        const priorityLamports = Math.max(mid, 1) * 0.2
        const sol = solUsd > 0 ? solUsd : 150
        if (!cancelled) {
          setGasUsd((5_000 / 1e9) * sol)
          setPriorityUsd((priorityLamports / 1e9) * sol)
        }
      } catch {
        if (!cancelled) {
          setGasUsd(0.02)
          setPriorityUsd(0.01)
        }
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 15_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [connection, solUsd])

  useEffect(() => {
    publishExec(execState)
  }, [execState, publishExec])
  useEffect(() => {
    publishSig(signature)
  }, [signature, publishSig])

  const builder: ExecutionBuilderState | null = useMemo(() => {
    if (!mint || !(price > 0)) return null
    return computeBuilderState({
      wallet: wallet.publicKey?.toBase58() || '',
      token: {
        mint,
        symbol: bundle?.token.symbol || opp?.tokenSymbol || 'TOKEN',
        chain: 'solana',
      },
      side: opp?.action === 'SELL' || opp?.action === 'EXIT' ? 'sell' : 'buy',
      orderType: 'market',
      amountUsd,
      slippageToleranceBps: slippageBps,
      gasEstimateUsd: gasUsd,
      priorityFeeUsd: priorityUsd,
      currentPrice: price,
      stopLoss: null,
      takeProfit: null,
    })
  }, [
    mint,
    price,
    wallet.publicKey,
    bundle?.token.symbol,
    opp?.tokenSymbol,
    opp?.action,
    amountUsd,
    slippageBps,
    gasUsd,
    priorityUsd,
  ])

  const totalCost = builder?.totalEstimatedCostUsd ?? null
  const feeLine = (amountUsd * slippageBps) / 10_000

  const refreshQuote = useCallback(async () => {
    if (!mint || amountUsd <= 0) return
    setError(null)
    setExecState('building')
    try {
      const solAmount = amountUsd / Math.max(solUsd, 1)
      const [qRes, aRes] = await Promise.all([
        fetch('/api/revenue/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputMint: SOL_MINT,
            outputMint: mint,
            amount: solAmount,
            slippageBps,
          }),
        }),
        fetch('/api/revenue/assess-swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromToken: SOL_MINT,
            toToken: mint,
            amountUsd,
            slippageBps,
            walletAddress: wallet.publicKey?.toBase58(),
          }),
        }),
      ])
      const qBody = await qRes.json()
      if (!qRes.ok) throw new Error(qBody.error ?? 'Quote unavailable')
      setQuote(qBody as SwapQuote)
      if (aRes.ok) setDecision((await aRes.json()) as SwapDecision)
      else setDecision(null)
    } catch (e) {
      setQuote(null)
      setError(e instanceof Error ? e.message : 'Quote failed')
    }
  }, [mint, amountUsd, slippageBps, solUsd, wallet.publicKey])

  useEffect(() => {
    void refreshQuote()
  }, [refreshQuote])

  const jitoEnabled =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_EXEC_JITO_ENABLED === 'true'
  const mev = useMemo(
    () =>
      computeMevProtection({
        amountUsd,
        liquidityUsd: liq,
        jitoEnabled,
        chain: 'solana',
      }),
    [amountUsd, liq, jitoEnabled],
  )

  const execute = async () => {
    if (!quote || !wallet.publicKey || !wallet.signTransaction || !builder || !mint) return
    if (decision?.verdict === 'BLOCKED') {
      setError(decision.blockedReason ?? 'Blocked by security')
      return
    }
    setError(null)
    setSignature(null)
    setExecState('simulating')
    const amountSol = amountUsd / Math.max(solUsd, 1)
    try {
      let swapTxBase64: string | null = null
      let opportunityId: string | null = null
      const prepRes = await fetch('/api/execution/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint,
          walletAddress: wallet.publicKey.toBase58(),
          amountSol,
          slippageBps,
          strategy: mev.route === 'jito_private' ? 'aggressive' : 'balanced',
          source: 'manual',
          symbol: builder.token.symbol,
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
        const prioritizationFeeLamports =
          mev.route === 'jito_private'
            ? { jitoTipLamports: mev.tipLamports }
            : ('auto' as const)
        const feeAcct = quote.platformFee.feeTokenAccount?.trim()
        swapTxBase64 = await buildJupiterSwapTransaction(
          quote.quote,
          wallet.publicKey.toBase58(),
          {
            prioritizationFeeLamports,
            ...(feeAcct && quote.platformFee.bps > 0 ? { feeAccount: feeAcct } : {}),
          },
        )
        const sim = await simulateSerializedSwapTransaction(connection, swapTxBase64)
        if (sim.sellSimulationFailed) {
          setExecState('simulation_failed')
          setError(
            sim.rpcError
              ? `Simulation would revert — ${sim.rpcError}`
              : 'Simulation would revert — not sent to wallet.',
          )
          return
        }
      } else if (!prepRes.ok || !prepBody?.allowed || !prepBody?.swapTransaction) {
        setExecState('simulation_failed')
        setError(
          typeof prepBody?.blockReason === 'string'
            ? prepBody.blockReason
            : typeof prepBody?.error === 'string'
              ? prepBody.error
              : 'Prepare blocked — not sent to wallet.',
        )
        return
      } else {
        opportunityId = typeof prepBody.opportunityId === 'string' ? prepBody.opportunityId : null
        swapTxBase64 = String(prepBody.swapTransaction)
      }

      if (!swapTxBase64) throw new Error('No unsigned transaction')

      setExecState('awaiting_signature')
      const tx = VersionedTransaction.deserialize(Buffer.from(swapTxBase64, 'base64'))
      const signed = await wallet.signTransaction(tx)

      setExecState('broadcasting')
      const sent = await sendSignedSwap({
        signed,
        connection,
        strategy: mev.route === 'jito_private' ? 'aggressive' : 'balanced',
        opportunityId,
      })

      setExecState('pending_confirmation')
      setSignature(sent.signature)

      let confirmed = false
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        const st = await connection.getSignatureStatuses([sent.signature])
        const v = st?.value?.[0]
        if (v?.err) {
          setExecState('reverted')
          setError('Transaction reverted on-chain')
          return
        }
        if (v?.confirmationStatus === 'confirmed' || v?.confirmationStatus === 'finalized') {
          confirmed = true
          break
        }
      }
      setExecState(confirmed ? 'confirmed' : 'pending_confirmation')
      if (!confirmed) setError('Still confirming — check your wallet explorer if this persists.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Execution failed'
      setExecState('failed')
      if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('cancel')) {
        setError('Wallet rejected the signature request.')
      } else {
        setError(msg)
      }
    }
  }

  const busy =
    execState === 'simulating' ||
    execState === 'awaiting_signature' ||
    execState === 'broadcasting' ||
    execState === 'pending_confirmation'

  const executeEnabled =
    Boolean(walletConnected && mint && quote && builder && totalCost != null && totalCost > 0) &&
    !busy &&
    decision?.verdict !== 'BLOCKED' &&
    Boolean(opp) &&
    (opp?.action === 'BUY' || opp?.action === 'SELL' || opp?.action === 'EXIT')

  if (!walletConnected) {
    return (
      <div className="sm-workspace">
        <h2 className="sm-workspace-title">Execution</h2>
        <p className="sm-workspace-q">Should you approve this AI recommendation?</p>
        <p className="sm-empty">Link your Secure Account first — your wallet always signs.</p>
        <SimpleSecureAccount />
      </div>
    )
  }

  if (!opp) {
    return (
      <div className="sm-workspace">
        <h2 className="sm-workspace-title">Execution</h2>
        <p className="sm-workspace-q">Should you approve this AI recommendation?</p>
        <p className="sm-empty">
          Not enough data yet — ask Trade Like Me (Pro) or wait until AI scores a live opportunity.
        </p>
      </div>
    )
  }

  const reasons =
    narrative?.bullets?.slice(0, 4) ||
    opp.reasons.slice(0, 4) ||
    ['See AI reasoning in Coach for full citations.']

  return (
    <div className="sm-workspace sm-exec">
      <h2 className="sm-workspace-title">{SIMPLE_VOCAB.quickSwap}</h2>
      <p className="sm-workspace-q">Should you approve this AI recommendation?</p>

      <div className="sm-exec-card">
        <p className="sm-exec-rec">
          AI recommends: <strong>{opp.action} {opp.tokenSymbol}</strong>
        </p>
        <p className="sm-exec-conf">Confidence: {Math.round(opp.scores.confidence)}%</p>
        <p className="sm-exec-why">
          <span className="sm-label">Reasoning</span>
          {reasons.join(' · ')}
        </p>

        <label className="sm-field">
          <span className="sm-label">Amount (USD)</span>
          <input
            className="sm-input"
            type="number"
            min={1}
            step={1}
            value={amountUsd}
            onChange={(e) => setAmountUsd(Number(e.target.value) || 0)}
          />
        </label>

        <div className="sm-cost">
          <div className="sm-cost-row">
            <span>{SIMPLE_VOCAB.estimatedTotalCost}</span>
            <strong>
              {totalCost != null ? `$${totalCost.toFixed(2)}` : '—'}
            </strong>
          </div>
          <button
            type="button"
            className="sm-link"
            onClick={() => setShowCostDetails((v) => !v)}
          >
            {SIMPLE_VOCAB.viewDetails} {showCostDetails ? '▴' : '▾'}
          </button>
          {showCostDetails ? (
            <ul className="sm-cost-details">
              <li>Amount ${amountUsd.toFixed(2)}</li>
              <li>Network fee ~${gasUsd.toFixed(4)}</li>
              <li>Priority ~${priorityUsd.toFixed(4)}</li>
              <li>Slippage tolerance {(slippageBps / 100).toFixed(2)}% (~${feeLine.toFixed(2)})</li>
              {quote?.platformFee.amountUsd != null ? (
                <li>Platform fee ${quote.platformFee.amountUsd.toFixed(4)}</li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <button
          type="button"
          className="sm-link"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {SIMPLE_VOCAB.advanced} {showAdvanced ? '▴' : '▾'}
        </button>
        {showAdvanced ? (
          <label className="sm-field">
            <span className="sm-label">Slippage tolerance (bps)</span>
            <input
              className="sm-input"
              type="number"
              min={10}
              max={1000}
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value) || 100)}
            />
          </label>
        ) : null}

        <p className="sm-exec-state" data-state={execState}>
          {stateMessage(execState)}
        </p>
        {error ? <p className="sm-error">{error}</p> : null}
        {signature ? (
          <p className="sm-muted-line">Signature {signature.slice(0, 8)}…{signature.slice(-6)}</p>
        ) : null}

        <button
          type="button"
          className="sm-btn sm-btn-primary sm-btn-block"
          disabled={!executeEnabled || totalCost == null}
          onClick={() => void execute()}
        >
          {busy ? stateMessage(execState) : SIMPLE_VOCAB.execute}
        </button>
        <p className="sm-disclaimer">
          Not financial advice · DYOR · Your wallet signs — CryptoCheck never holds funds.
        </p>
      </div>
    </div>
  )
}
