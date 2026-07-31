'use client'

/**
 * Secure Execution (AI Swap) — never labeled "swap" in UI.
 * Always simulate before signature. Critical security flags block by default.
 * Reuses /api/revenue/quote + assess-swap + OMS prepare / Jupiter + client-submit + Jito.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { VersionedTransaction } from '@solana/web3.js'
import { DangerAcknowledgeModal, DANGER_ACK_PHRASE } from '@/components/revenue-dashboard/DangerAcknowledgeModal'
import { buildJupiterSwapTransaction } from '@/lib/trading/jupiter-client'
import type { SwapDecision } from '@/lib/trading/risk-gated-swap'
import type { SwapQuote } from '@/lib/revenue-dashboard/types'
import { simulateSerializedSwapTransaction } from '@/lib/services/swap-simulation'
import { sendSignedSwap } from '@/lib/execution/client-submit'
import { useIntelligenceChart } from '@/features/intelligence-chart/hooks/useIntelligenceChart'
import { computeMevProtection } from '../lib/mev-score'
import type { ExecutionAuditPayload, ExecutionBuilderState, ExecutionState } from '../types'
import { LARGE_TRADE_PHRASE, LARGE_TRADE_USD_THRESHOLD, OVERRIDE_PHRASE } from '../types'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const CRITICAL_WARNINGS = new Set([
  'HONEYPOT_RISK',
  'MINT_AUTHORITY_ACTIVE',
  'RUGPULL_PATTERN_DETECTED',
])

function stateLabel(s: ExecutionState): string {
  switch (s) {
    case 'building':
      return 'Building order'
    case 'simulating':
      return 'Simulating against chain state'
    case 'simulation_failed':
      return 'Simulation failed — not submitted'
    case 'awaiting_signature':
      return 'Awaiting wallet signature'
    case 'broadcasting':
      return 'Broadcasting via private / priority path'
    case 'pending_confirmation':
      return 'Pending confirmation'
    case 'confirmed':
      return 'Confirmed — position created'
    case 'failed':
      return 'Failed'
    case 'reverted':
      return 'Reverted on-chain'
  }
}

async function postAudit(payload: ExecutionAuditPayload) {
  try {
    await fetch('/api/execution/desk-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    /* audit must not block UX; best-effort */
  }
}

export function SecureExecutionPanel({
  query,
  builder,
}: {
  query: string
  builder: ExecutionBuilderState | null
}) {
  const { connection } = useConnection()
  const wallet = useWallet()
  const { data: bundle } = useIntelligenceChart(query, 'solana')

  const mint = builder?.token.mint && builder.token.mint.length >= 32 ? builder.token.mint : ''
  const amountUsd = builder?.amountUsd ?? 0
  const slippageBps = builder?.slippageToleranceBps ?? 100

  const [execState, setExecState] = useState<ExecutionState>('building')
  const [decision, setDecision] = useState<SwapDecision | null>(null)
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [pendingSince, setPendingSince] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const [dangerOpen, setDangerOpen] = useState(false)
  const [dangerTyped, setDangerTyped] = useState('')
  const [overrideOk, setOverrideOk] = useState(false)
  const [largeTyped, setLargeTyped] = useState('')
  const [largeOk, setLargeOk] = useState(false)

  const jitoEnabled =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_EXEC_JITO_ENABLED === 'true'

  const mev = useMemo(
    () =>
      computeMevProtection({
        amountUsd,
        liquidityUsd: bundle?.token.liquidityUsd ?? 0,
        jitoEnabled,
        chain: 'solana',
      }),
    [amountUsd, bundle?.token.liquidityUsd, jitoEnabled],
  )

  const needsOverride =
    decision?.verdict === 'HIGH_RISK' ||
    Boolean(decision?.warnings?.some((w) => CRITICAL_WARNINGS.has(w)))

  const isLarge = amountUsd >= LARGE_TRADE_USD_THRESHOLD

  useEffect(() => {
    if (execState !== 'pending_confirmation' || pendingSince == null) return
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - pendingSince) / 1000))
    }, 500)
    return () => window.clearInterval(id)
  }, [execState, pendingSince])

  const refreshAssessAndQuote = useCallback(async () => {
    if (!mint || amountUsd <= 0) return
    setError(null)
    setExecState('building')
    setOverrideOk(false)
    try {
      const solPrice =
        bundle?.token.symbol?.toUpperCase() === 'SOL' && bundle.token.priceUsd > 0
          ? bundle.token.priceUsd
          : 150
      const solAmount = amountUsd / Math.max(solPrice, 1)
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
      if (!qRes.ok) throw new Error(qBody.error ?? 'Quote failed')
      setQuote(qBody as SwapQuote)
      if (aRes.ok) {
        const d = (await aRes.json()) as SwapDecision
        setDecision(d)
      } else {
        setDecision(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quote/assess failed')
      setQuote(null)
    }
  }, [mint, amountUsd, slippageBps, wallet.publicKey, bundle])

  useEffect(() => {
    void refreshAssessAndQuote()
  }, [refreshAssessAndQuote])

  const executeSecurely = async () => {
    if (!quote || !wallet.publicKey || !wallet.signTransaction || !builder) return
    if (decision?.verdict === 'BLOCKED' || (decision && !decision.allowed && decision.verdict === 'BLOCKED')) {
      setError(decision.blockedReason ?? 'Blocked by Security Scanner')
      return
    }
    if (needsOverride && !overrideOk) {
      setDangerOpen(true)
      return
    }
    if (isLarge && !largeOk) {
      setError(`Large trade — type “${LARGE_TRADE_PHRASE}” to continue.`)
      return
    }

    setError(null)
    setSignature(null)
    setExecState('simulating')

    const solPrice =
      bundle?.token.symbol?.toUpperCase() === 'SOL' && bundle.token.priceUsd > 0
        ? bundle.token.priceUsd
        : 150
    const amountSol = amountUsd / Math.max(solPrice, 1)

    try {
      let swapTxBase64: string | null = null
      let opportunityId: string | null = null

      // Prefer OMS prepare (server sim + Jito plan) when authenticated
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
        simulation?: { confidence?: number }
      }

      if (prepRes.status === 401) {
        // Unauthenticated fallback: client Jupiter build + local simulate
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
              ? `Simulation would revert — ${sim.rpcError}. Refresh quote and retry.`
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
              : 'OMS prepare blocked — not sent to wallet.',
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
      setPendingSince(Date.now())
      setSignature(sent.signature)

      let confirmed = false
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        const st = await connection.getSignatureStatuses([sent.signature])
        const v = st?.value?.[0]
        if (v?.err) {
          setExecState('reverted')
          setError(typeof v.err === 'string' ? v.err : 'Transaction reverted on-chain')
          await postAudit({
            builder,
            securityVerdict: decision?.verdict ?? 'UNKNOWN',
            securityRiskScore: decision?.riskScore ?? -1,
            signature: sent.signature,
            executionState: 'reverted',
            at: new Date().toISOString(),
          })
          return
        }
        if (v?.confirmationStatus === 'confirmed' || v?.confirmationStatus === 'finalized') {
          confirmed = true
          break
        }
      }

      if (!confirmed) {
        setExecState('pending_confirmation')
        setError('Still confirming — open explorer if this persists.')
      } else {
        setExecState('confirmed')
        await postAudit({
          builder,
          securityVerdict: decision?.verdict ?? 'UNKNOWN',
          securityRiskScore: decision?.riskScore ?? -1,
          signature: sent.signature,
          executionState: 'confirmed',
          at: new Date().toISOString(),
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Execution failed'
      setExecState('failed')
      if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('cancel')) {
        setError('Wallet rejected the signature request.')
      } else {
        setError(msg)
      }
      await postAudit({
        builder,
        securityVerdict: decision?.verdict ?? 'UNKNOWN',
        securityRiskScore: decision?.riskScore ?? -1,
        executionState: 'failed',
        at: new Date().toISOString(),
      })
    }
  }

  const executeDisabled =
    !mint ||
    !quote ||
    !wallet.publicKey ||
    execState === 'simulating' ||
    execState === 'awaiting_signature' ||
    execState === 'broadcasting' ||
    execState === 'pending_confirmation' ||
    decision?.verdict === 'BLOCKED' ||
    (needsOverride && !overrideOk)

  const feeUsd = quote?.platformFee.amountUsd

  return (
    <section className="ex-panel ex-secure" aria-label="Secure Execution">
      <header className="ex-panel-head">
        <h2>Secure Execution</h2>
        <span className="ex-badge" data-state={execState}>
          {stateLabel(execState)}
        </span>
      </header>

      <div className="ex-secure-grid">
        <div>
          <p className="ex-label">Security Scanner</p>
          <p className={`ex-verdict ex-verdict-${(decision?.verdict ?? 'UNKNOWN').toLowerCase()}`}>
            {decision?.verdict ?? 'Scanning…'}
            {decision ? ` · risk ${decision.riskScore}` : ''}
          </p>
          {decision?.reasons?.slice(0, 3).map((r) => (
            <p key={r} className="ex-muted">
              {r}
            </p>
          ))}
        </div>
        <div>
          <p className="ex-label">MEV protection</p>
          <p className="ex-mev">
            Score {mev.riskScore} · {mev.route.replace(/_/g, ' ')} · {mev.congestion}
          </p>
          <p className="ex-muted">{mev.explanation}</p>
        </div>
      </div>

      {quote ? (
        <p className="ex-fee-line">
          Impact {quote.priceImpactPct.toFixed(3)}% · Slippage {quote.slippageBps} bps
          {feeUsd != null ? ` · Platform fee ~$${feeUsd.toFixed(4)}` : ''}
          {quote.platformFee.bps > 0 ? ` (${quote.platformFee.bps} bps)` : ''}
        </p>
      ) : null}

      {needsOverride && !overrideOk && decision?.verdict !== 'BLOCKED' ? (
        <div className="ex-override">
          <p className="ex-warn">
            Critical / high-risk flags present. Execute is disabled until typed override.
          </p>
          <button type="button" className="ex-btn-ghost" onClick={() => setDangerOpen(true)}>
            Override and proceed anyway
          </button>
        </div>
      ) : null}

      {decision?.verdict === 'BLOCKED' ? (
        <p className="ex-danger">Hard-blocked by Security Scanner — no override available.</p>
      ) : null}

      {isLarge ? (
        <label className="ex-label">
          Large trade confirmation — type {LARGE_TRADE_PHRASE}
          <input
            className="ex-input"
            value={largeTyped}
            onChange={(e) => {
              setLargeTyped(e.target.value)
              setLargeOk(e.target.value.trim() === LARGE_TRADE_PHRASE)
            }}
            autoComplete="off"
          />
        </label>
      ) : null}

      <button
        type="button"
        className="ex-btn-primary"
        disabled={executeDisabled || (isLarge && !largeOk)}
        onClick={() => void executeSecurely()}
      >
        Execute Securely
      </button>

      {error ? <p className="ex-danger">{error}</p> : null}

      {execState === 'pending_confirmation' ? (
        <p className="ex-muted">
          Elapsed {elapsed}s
          {signature ? (
            <>
              {' '}
              ·{' '}
              <a
                href={`https://solscan.io/tx/${signature}`}
                target="_blank"
                rel="noreferrer"
                className="ex-link"
              >
                View on explorer
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {execState === 'confirmed' && signature ? (
        <div className="ex-complete">
          <p>
            Execution complete → Position created → AI monitoring started → Security layer active →
            Autonomous execution can arm.
          </p>
          <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer" className="ex-link">
            {signature.slice(0, 8)}…{signature.slice(-8)}
          </a>
        </div>
      ) : null}

      <p className="ex-disclaimer">
        Not financial advice · DYOR · Simulate before sign · Platform fees shown before confirm.
      </p>

      <DangerAcknowledgeModal
        open={dangerOpen}
        typed={dangerTyped}
        onTypedChange={setDangerTyped}
        onClose={() => setDangerOpen(false)}
        onConfirm={() => {
          const t = dangerTyped.trim()
          if (
            t.toLowerCase() === DANGER_ACK_PHRASE.toLowerCase() ||
            t === OVERRIDE_PHRASE
          ) {
            setOverrideOk(true)
            setDangerOpen(false)
            setDangerTyped('')
          }
        }}
      />
    </section>
  )
}
