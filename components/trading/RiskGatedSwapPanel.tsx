'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { VersionedTransaction } from '@solana/web3.js'
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, TriangleAlert } from 'lucide-react'
import { getJupiterQuote, buildJupiterSwapTransaction } from '@/lib/trading/jupiter-client'
import type { SwapDecision, SwapWarning } from '@/lib/trading/risk-gated-swap'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

const WARNING_LABEL: Record<SwapWarning, string> = {
  LOW_LIQUIDITY: 'Low liquidity',
  HIGH_PRICE_IMPACT: 'High price impact',
  HONEYPOT_RISK: 'Honeypot risk',
  MINT_AUTHORITY_ACTIVE: 'Mint authority active',
  NEW_TOKEN_UNDER_24H: 'New token (<24h)',
  TOP_HOLDER_CONCENTRATION: 'Top-holder concentration',
  FREEZE_AUTHORITY_ACTIVE: 'Freeze authority active',
  LP_UNLOCKED: 'LP unlocked',
  RUGPULL_PATTERN_DETECTED: 'Rugpull pattern detected',
}

type SwapResult = { signature: string }

type Props = {
  defaultFromToken?: string
  defaultToToken?: string
  defaultAmountUsd?: number
  onSwapComplete?: (result: SwapResult) => void
}

type VerdictTheme = {
  ring: string
  badge: string
  icon: typeof ShieldCheck
  label: string
}

function themeFor(decision: SwapDecision | null): VerdictTheme {
  const v = decision?.verdict
  if (v === 'SAFE') return { ring: 'border-emerald-500/40 bg-emerald-500/[0.06]', badge: 'text-emerald-300', icon: ShieldCheck, label: 'SAFE' }
  if (v === 'CAUTION') return { ring: 'border-amber-500/40 bg-amber-500/[0.06]', badge: 'text-amber-300', icon: ShieldAlert, label: 'CAUTION' }
  if (v === 'HIGH_RISK') return { ring: 'border-orange-500/45 bg-orange-500/[0.08]', badge: 'text-orange-300', icon: TriangleAlert, label: 'HIGH RISK' }
  if (v === 'BLOCKED') return { ring: 'border-rose-500/50 bg-rose-500/[0.08]', badge: 'text-rose-300', icon: ShieldX, label: 'BLOCKED' }
  return { ring: 'border-white/10 bg-slate-950/60', badge: 'text-slate-400', icon: ShieldCheck, label: '—' }
}

export function RiskGatedSwapPanel({
  defaultFromToken = SOL_MINT,
  defaultToToken = '',
  defaultAmountUsd,
  onSwapComplete,
}: Props) {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [fromToken] = useState(defaultFromToken)
  const [toToken, setToToken] = useState(defaultToToken)
  const [amountUsd, setAmountUsd] = useState<string>(
    defaultAmountUsd && defaultAmountUsd > 0 ? String(defaultAmountUsd) : '50'
  )
  const [slippageBps] = useState(50)

  const [decision, setDecision] = useState<SwapDecision | null>(null)
  const [assessing, setAssessing] = useState(false)
  const [assessError, setAssessError] = useState<string | null>(null)
  const [confirmHighRisk, setConfirmHighRisk] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)

  useEffect(() => {
    setToToken(defaultToToken)
  }, [defaultToToken])

  const assessSeq = useRef(0)

  const runAssessment = useCallback(async () => {
    const mint = toToken.trim()
    const usd = Number(amountUsd)
    if (mint.length < 32 || !Number.isFinite(usd) || usd <= 0) {
      setDecision(null)
      return
    }
    const seq = ++assessSeq.current
    setAssessing(true)
    setAssessError(null)
    setConfirmHighRisk(false)
    try {
      const res = await fetch('/api/trading/assess-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromToken, toToken: mint, amountUsd: usd, slippageBps, walletAddress: wallet.publicKey?.toBase58() }),
      })
      const body = (await res.json().catch(() => ({}))) as SwapDecision & { error?: string }
      if (seq !== assessSeq.current) return
      if (!res.ok) {
        setAssessError(body.error || 'Risk assessment failed')
        setDecision(null)
        return
      }
      setDecision(body)
    } catch {
      if (seq === assessSeq.current) setAssessError('Network error during risk assessment')
    } finally {
      if (seq === assessSeq.current) setAssessing(false)
    }
  }, [fromToken, toToken, amountUsd, slippageBps, wallet.publicKey])

  // Debounced auto-assessment on token / amount change.
  useEffect(() => {
    const t = setTimeout(() => void runAssessment(), 400)
    return () => clearTimeout(t)
  }, [runAssessment])

  const approxLamports = useCallback(() => {
    const usd = Number(amountUsd)
    const solPrice = 150
    return Math.max(1, Math.floor((usd / solPrice) * 1e9))
  }, [amountUsd])

  const onSwap = useCallback(async () => {
    if (!decision || !decision.allowed) return
    if (decision.verdict === 'HIGH_RISK' && !confirmHighRisk) return
    if (!wallet.publicKey || !wallet.signTransaction) {
      setSwapError('Connect a wallet to swap.')
      return
    }
    setSwapping(true)
    setSwapError(null)
    setSignature(null)
    try {
      const quote = await getJupiterQuote(fromToken, toToken.trim(), approxLamports(), slippageBps)
      const swapTxBase64 = await buildJupiterSwapTransaction(quote, wallet.publicKey.toBase58())
      const tx = VersionedTransaction.deserialize(Buffer.from(swapTxBase64, 'base64'))
      const signed = await wallet.signTransaction(tx)
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false })
      setSignature(sig)
      onSwapComplete?.({ signature: sig })
    } catch (e) {
      setSwapError(e instanceof Error ? e.message : 'Swap failed')
    } finally {
      setSwapping(false)
    }
  }, [decision, confirmHighRisk, wallet, fromToken, toToken, approxLamports, slippageBps, connection, onSwapComplete])

  const theme = themeFor(decision)
  const Icon = theme.icon
  const blocked = decision?.verdict === 'BLOCKED' || decision?.allowed === false
  const needsConfirm = decision?.verdict === 'HIGH_RISK'

  return (
    <div className="mx-auto w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl">
      <div className="space-y-3">
        <div>
          <label className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">To (mint)</label>
          <input
            value={toToken}
            onChange={(e) => setToToken(e.target.value.trim())}
            placeholder="Solana mint address"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#020617] px-3.5 py-2.5 font-mono text-xs text-slate-100 outline-none focus:border-[#00d4aa]/45 focus:ring-2 focus:ring-[#00d4aa]/20"
          />
        </div>
        <div>
          <label className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Amount (USD)</label>
          <input
            type="number"
            min={0}
            value={amountUsd}
            onChange={(e) => setAmountUsd(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#020617] px-3.5 py-2.5 font-mono text-sm text-slate-100 outline-none focus:border-[#00d4aa]/45 focus:ring-2 focus:ring-[#00d4aa]/20"
          />
        </div>
      </div>

      <div className={`rounded-xl border p-4 ${theme.ring}`}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Icon className={`h-4 w-4 ${theme.badge}`} aria-hidden />
            Risk assessment
          </span>
          {assessing ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin text-slate-400" aria-hidden />
          ) : decision ? (
            <span className={`text-sm font-bold tabular-nums ${theme.badge}`}>
              {decision.riskScore}/100 · {theme.label}
            </span>
          ) : null}
        </div>

        {assessError ? <p className="mt-2 text-xs text-rose-300">{assessError}</p> : null}

        {decision ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2 text-[0.7rem]">
              <span className="rounded-md border border-white/10 px-2 py-0.5 text-slate-400">confidence: {decision.confidence}</span>
              {typeof decision.simulatedPriceImpact === 'number' ? (
                <span className={`rounded-md border px-2 py-0.5 ${decision.simulatedPriceImpact > 2 ? 'border-amber-500/40 text-amber-300' : 'border-white/10 text-slate-400'}`}>
                  impact: {decision.simulatedPriceImpact.toFixed(2)}%
                </span>
              ) : null}
            </div>
            {decision.warnings.length > 0 ? (
              <ul className="space-y-1">
                {decision.warnings.map((w) => (
                  <li key={w} className="text-xs text-slate-300">• {WARNING_LABEL[w]}</li>
                ))}
              </ul>
            ) : null}
            {decision.reasons.length > 0 ? (
              <p className="text-[0.7rem] leading-relaxed text-slate-500">{decision.reasons.join(' ')}</p>
            ) : null}
            {blocked && decision.blockedReason ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{decision.blockedReason}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {needsConfirm && !blocked ? (
        <label className="flex items-start gap-2 text-xs text-orange-200">
          <input type="checkbox" checked={confirmHighRisk} onChange={(e) => setConfirmHighRisk(e.target.checked)} className="mt-0.5" />
          I understand this token is HIGH RISK and want to proceed anyway.
        </label>
      ) : null}

      {blocked ? (
        <button disabled className="w-full cursor-not-allowed rounded-xl bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-200">
          BLOCKED — too risky to swap
        </button>
      ) : (
        <button
          onClick={() => void onSwap()}
          disabled={!decision || !decision.allowed || swapping || (needsConfirm && !confirmHighRisk) || !wallet.publicKey}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d4aa] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:pointer-events-none disabled:opacity-45"
        >
          {swapping ? (
            <>
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> Swapping…
            </>
          ) : !wallet.publicKey ? (
            'Connect wallet to swap'
          ) : needsConfirm ? (
            'Swap with caution'
          ) : (
            'Swap now'
          )}
        </button>
      )}

      {swapError ? <p className="text-xs text-rose-300">{swapError}</p> : null}
      {signature ? (
        <a
          href={`https://solscan.io/tx/${signature}`}
          target="_blank"
          rel="noreferrer"
          className="block break-all text-center text-xs text-[#00d4aa] underline"
        >
          View transaction: {signature.slice(0, 8)}…
        </a>
      ) : null}

      <p className="text-center text-[0.6rem] leading-relaxed text-slate-600">
        AI risk analysis only. Not financial advice. Trade at your own risk.
      </p>
    </div>
  )
}
