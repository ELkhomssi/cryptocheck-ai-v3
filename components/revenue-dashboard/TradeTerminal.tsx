'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, VersionedTransaction } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { VerdictPanel } from './VerdictPanel'
import { DangerAcknowledgeModal } from './DangerAcknowledgeModal'
import { RevenueComplianceNote } from './RevenueComplianceNote'
import {
  DEFAULT_SLIPPAGE_BPS,
  HIGH_PRICE_IMPACT_WARN_PCT,
  MAX_SLIPPAGE_BPS,
  REVENUE_NAV,
  terminalDeepLink,
} from '@/lib/revenue-dashboard/constants'
import type { ScanResult, SwapQuote } from '@/lib/revenue-dashboard/types'
import { isQuoteExpired } from '@/lib/revenue-dashboard/swap-quote'
import { buildJupiterSwapTransaction } from '@/lib/trading/jupiter-client'
import { isPlatformFeeConfigured } from '@/lib/trading/platform-fee-config'
import type { SwapDecision } from '@/lib/trading/risk-gated-swap'
import { simulateSerializedSwapTransaction } from '@/lib/services/swap-simulation'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

type InputAsset = 'SOL' | 'USDC'

function formatTokenOut(base: string, decimals = 6): string {
  const n = Number(base) / 10 ** decimals
  if (!Number.isFinite(n)) return '—'
  if (n >= 1e6) return n.toExponential(2)
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function pushSwapActivity(signature: string, mint: string) {
  try {
    const key = 'ccai:rev:activity'
    const raw = sessionStorage.getItem(key)
    const prev = raw ? (JSON.parse(raw) as unknown[]) : []
    const row = { type: 'swap', signature, mint, at: new Date().toISOString() }
    sessionStorage.setItem(key, JSON.stringify([row, ...prev].slice(0, 20)))
  } catch {
    /* ignore */
  }
}

export function TradeTerminal() {
  const searchParams = useSearchParams()
  const deepMint = searchParams.get('mint')?.trim() ?? ''
  const exitMint = searchParams.get('exitMint')?.trim() ?? ''
  const exitMode = exitMint.length >= 32
  const deepAmount = searchParams.get('amount')?.trim() ?? ''

  const { connection } = useConnection()
  const wallet = useWallet()

  const [mint, setMint] = useState(exitMode ? exitMint : deepMint)
  const [tokenDecimals, setTokenDecimals] = useState(6)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  const [inputAsset, setInputAsset] = useState<InputAsset>('SOL')
  const [amount, setAmount] = useState(exitMode && deepAmount ? deepAmount : '0.1')
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS)

  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const [swapDecision, setSwapDecision] = useState<SwapDecision | null>(null)

  const [dangerModalOpen, setDangerModalOpen] = useState(false)
  const [dangerTyped, setDangerTyped] = useState('')
  const [dangerAcknowledged, setDangerAcknowledged] = useState(false)

  const [swapping, setSwapping] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [feeRecorded, setFeeRecorded] = useState<string | null>(null)

  const scanSeq = useRef(0)
  const quoteSeq = useRef(0)

  const payMint = inputAsset === 'SOL' ? SOL_MINT : USDC_MINT
  const quoteInputMint = exitMode ? mint.trim() : payMint
  const quoteOutputMint = exitMode ? payMint : mint.trim()
  const amountNum = Number(amount)

  const scanTarget = exitMode ? exitMint : mint

  const runScan = useCallback(async (targetMint: string) => {
    const m = targetMint.trim()
    if (m.length < 32) {
      setScan(null)
      setScanError(null)
      return
    }
    const seq = ++scanSeq.current
    setScanLoading(true)
    setScanError(null)
    setDangerAcknowledged(false)
    setDangerTyped('')
    try {
      const res = await fetch('/api/revenue/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: m }),
      })
      const data = await res.json()
      if (seq !== scanSeq.current) return
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')
      setScan(data as ScanResult)
    } catch (e) {
      if (seq === scanSeq.current) {
        setScanError(e instanceof Error ? e.message : 'Scan failed')
        setScan(null)
      }
    } finally {
      if (seq === scanSeq.current) setScanLoading(false)
    }
  }, [])

  useEffect(() => {
    if (exitMode) setMint(exitMint)
    else if (deepMint) setMint(deepMint)
  }, [deepMint, exitMint, exitMode])

  useEffect(() => {
    if (!exitMode || !wallet.publicKey || !exitMint) return
    void (async () => {
      try {
        const ata = await getAssociatedTokenAddress(new PublicKey(exitMint), wallet.publicKey!)
        const bal = await connection.getTokenAccountBalance(ata)
        const dec = bal.value.decimals ?? 6
        setTokenDecimals(dec)
        if (!deepAmount && bal.value.uiAmount != null && bal.value.uiAmount > 0) {
          setAmount(String(bal.value.uiAmount))
        }
      } catch {
        /* wallet may not hold token */
      }
    })()
  }, [exitMode, exitMint, wallet.publicKey, connection, deepAmount])

  useEffect(() => {
    const t = setTimeout(() => void runScan(scanTarget), 300)
    return () => clearTimeout(t)
  }, [scanTarget, runScan])

  const approxVolumeUsd = useMemo(() => {
    if (!Number.isFinite(amountNum) || amountNum <= 0) return 0
    if (exitMode) {
      const outSol = quote?.outputMint === SOL_MINT ? Number(quote.outputAmountBase) / 1e9 : 0
      if (outSol > 0) return outSol * 150
      return amountNum * 0.01
    }
    if (inputAsset === 'USDC') return amountNum
    return amountNum * 150
  }, [amountNum, inputAsset, exitMode, quote])

  const runAssessSwap = useCallback(async () => {
    const riskMint = exitMode ? exitMint : mint.trim()
    if (riskMint.length < 32 || approxVolumeUsd <= 0) {
      setSwapDecision(null)
      return
    }
    try {
      const res = await fetch('/api/revenue/assess-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromToken: exitMode ? riskMint : payMint,
          toToken: riskMint,
          amountUsd: approxVolumeUsd,
          slippageBps,
          walletAddress: wallet.publicKey?.toBase58() ?? '',
        }),
      })
      const body = (await res.json()) as SwapDecision & { error?: string }
      if (res.ok) setSwapDecision(body)
      else setSwapDecision(null)
    } catch {
      setSwapDecision(null)
    }
  }, [mint, exitMint, exitMode, approxVolumeUsd, slippageBps, payMint, wallet.publicKey])

  const fetchQuote = useCallback(async () => {
    const out = quoteOutputMint
    const inp = quoteInputMint
    if (out.length < 32 || inp.length < 32 || !Number.isFinite(amountNum) || amountNum <= 0) {
      setQuote(null)
      return
    }
    const seq = ++quoteSeq.current
    setQuoteLoading(true)
    setQuoteError(null)
    try {
      const res = await fetch('/api/revenue/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint: inp,
          outputMint: out,
          amount: amountNum,
          slippageBps,
          tokenDecimals: exitMode ? tokenDecimals : undefined,
        }),
      })
      const data = await res.json()
      if (seq !== quoteSeq.current) return
      if (!res.ok) throw new Error(data.error ?? 'No route')
      setQuote(data as SwapQuote)
      void runAssessSwap()
    } catch (e) {
      if (seq === quoteSeq.current) {
        setQuoteError(e instanceof Error ? e.message : 'Quote failed')
        setQuote(null)
      }
    } finally {
      if (seq === quoteSeq.current) setQuoteLoading(false)
    }
  }, [quoteOutputMint, quoteInputMint, amountNum, slippageBps, runAssessSwap, exitMode, tokenDecimals])

  useEffect(() => {
    const t = setTimeout(() => void fetchQuote(), 450)
    return () => clearTimeout(t)
  }, [fetchQuote])

  const hardBlocked =
    swapDecision?.verdict === 'BLOCKED' ||
    swapDecision?.allowed === false ||
    Boolean(swapDecision?.blockedReason)

  const needsDangerAck =
    (scan?.verdict === 'DANGER' || swapDecision?.verdict === 'HIGH_RISK') && !dangerAcknowledged
  const showCautionBanner = scan?.verdict === 'CAUTION'

  const swapDisabled =
    hardBlocked ||
    needsDangerAck ||
    !quote ||
    quoteLoading ||
    swapping ||
    !wallet.publicKey ||
    !wallet.signTransaction

  const onExecuteSwap = useCallback(async () => {
    if (!quote || !wallet.publicKey || !wallet.signTransaction || swapDisabled) return

    setSwapping(true)
    setSwapError(null)
    setSignature(null)

    try {
      let activeQuote = quote
      if (isQuoteExpired(activeQuote)) {
        const res = await fetch('/api/revenue/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputMint: activeQuote.inputMint,
            outputMint: activeQuote.outputMint,
            amount: amountNum,
            slippageBps,
            tokenDecimals: exitMode ? tokenDecimals : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Quote expired — re-quote failed')
        activeQuote = data as SwapQuote
        setQuote(activeQuote)
      }

      const balance = await checkSufficientBalance(
        connection,
        wallet.publicKey,
        activeQuote.inputMint,
        activeQuote.inputAmountBase,
        tokenDecimals,
      )
      if (!balance.ok) throw new Error('message' in balance ? balance.message : 'Insufficient balance')

      const feeAccount = activeQuote.platformFee.feeTokenAccount?.trim()
      const swapTxBase64 = await buildJupiterSwapTransaction(
        activeQuote.quote,
        wallet.publicKey.toBase58(),
        feeAccount && activeQuote.platformFee.bps > 0 ? { feeAccount } : undefined,
      )

      const sim = await simulateSerializedSwapTransaction(connection, swapTxBase64)
      if (sim.sellSimulationFailed) {
        throw new Error(sim.rpcError ?? 'Transaction simulation failed — swap blocked.')
      }

      const tx = VersionedTransaction.deserialize(Buffer.from(swapTxBase64, 'base64'))
      const signed = await wallet.signTransaction(tx)
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 2,
      })
      await connection.confirmTransaction(sig, 'confirmed')

      setSignature(sig)
      pushSwapActivity(sig, mint.trim())

      const feeBase = activeQuote.platformFee.amountBase
      const recordRes = await fetch('/api/revenue/record-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: sig,
          walletAddress: wallet.publicKey.toBase58(),
          inputMint: activeQuote.inputMint,
          outputMint: activeQuote.outputMint,
          volumeUsd: approxVolumeUsd,
          feeBps: activeQuote.platformFee.bps,
          feeAmountBase: feeBase,
          feeAmountUsd: activeQuote.platformFee.amountUsd,
          feeTokenAccount: activeQuote.platformFee.feeTokenAccount,
        }),
      })
      if (recordRes.ok) {
        const j = (await recordRes.json()) as { record?: { id: string } }
        setFeeRecorded(j.record?.id ?? 'recorded')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Swap failed'
      if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('rejected')) {
        setSwapError('Transaction cancelled in wallet.')
      } else {
        setSwapError(msg)
      }
    } finally {
      setSwapping(false)
    }
  }, [
    quote,
    wallet,
    swapDisabled,
    connection,
    exitMode,
    tokenDecimals,
    amountNum,
    slippageBps,
    approxVolumeUsd,
  ])

  return (
    <div className="space-y-5">
      <header>
        <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-rd-violet">
          Trade terminal
        </p>
        <h2 className="mt-1 font-rd-display text-xl font-bold uppercase tracking-[0.06em] text-rd-hi md:text-2xl">
          {exitMode ? 'Exit to safety' : 'Scan → safe swap'}
        </h2>
        {exitMode ? (
          <p className="mt-2 text-sm text-rd-caution">Selling flagged holding into SOL/USDC.</p>
        ) : null}
      </header>

      <div className="rd-panel p-4">
        <label htmlFor="terminal-mint" className="rd-label">
          {exitMode ? 'Token to sell' : 'Token mint'}
        </label>
        <input
          id="terminal-mint"
          value={mint}
          onChange={(e) => !exitMode && setMint(e.target.value.trim())}
          readOnly={exitMode}
          placeholder="Paste Solana token mint…"
          className="mt-2 w-full rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2.5 font-rd-mono text-sm text-rd-hi focus:border-rd-violet/50 focus:outline-none focus:ring-1 focus:ring-rd-violet/30"
          spellCheck={false}
        />
      </div>

      <VerdictPanel scan={scan} loading={scanLoading} error={scanError} />

      <section className="rd-panel p-4 md:p-5" aria-label="Swap">
        <p className="rd-label mb-3">{exitMode ? 'Sell' : 'Swap'}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="text-xs text-rd-lo">{exitMode ? 'Receive' : 'Pay with'}</span>
            <div className="mt-1 flex gap-2">
              {(['SOL', 'USDC'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setInputAsset(a)}
                  className={`rounded-rd-sm border px-3 py-1.5 font-rd-display text-[0.6rem] font-bold uppercase tracking-wider ${
                    inputAsset === a
                      ? 'border-rd-green/50 bg-rd-green/10 text-rd-green'
                      : 'border-white/10 text-rd-mid'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="swap-amount" className="text-xs text-rd-lo">
              Amount ({exitMode ? 'tokens' : inputAsset})
            </label>
            <input
              id="swap-amount"
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2 font-rd-mono text-sm tabular-nums text-rd-hi"
            />
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="slippage" className="text-xs text-rd-lo">
            Slippage (bps, max {MAX_SLIPPAGE_BPS})
          </label>
          <input
            id="slippage"
            type="number"
            min={1}
            max={MAX_SLIPPAGE_BPS}
            value={slippageBps}
            onChange={(e) =>
              setSlippageBps(Math.min(MAX_SLIPPAGE_BPS, Math.max(1, Number(e.target.value) || DEFAULT_SLIPPAGE_BPS)))
            }
            className="mt-1 w-full max-w-[8rem] rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2 font-rd-mono text-sm tabular-nums"
          />
        </div>

        {quoteLoading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-rd-mid">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> Fetching Jupiter quote…
          </p>
        ) : null}

        {quoteError ? (
          <p className="mt-4 text-sm text-rd-danger" role="alert">
            {quoteError}
          </p>
        ) : null}

        {quote ? (
          <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-rd-mid">Route</span>
              <span className="font-rd-mono text-xs text-rd-hi">{quote.routeLabel}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-rd-mid">You receive (est.)</span>
              <span className="font-rd-mono tabular-nums text-rd-hi">
                {formatTokenOut(quote.outputAmountBase)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-rd-mid">Min received</span>
              <span className="font-rd-mono tabular-nums text-rd-lo">
                {formatTokenOut(quote.outputAmountMinBase)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-rd-mid">Price impact</span>
              <span
                className={`font-rd-mono tabular-nums ${
                  quote.priceImpactPct > HIGH_PRICE_IMPACT_WARN_PCT ? 'text-rd-caution' : 'text-rd-hi'
                }`}
              >
                {quote.priceImpactPct.toFixed(2)}%
                {quote.priceImpactPct > HIGH_PRICE_IMPACT_WARN_PCT ? ' — high' : ''}
              </span>
            </div>
            <div className="flex justify-between gap-2 border-t border-white/[0.06] pt-2">
              <span className="text-rd-mid">CryptoCheck platform fee</span>
              <span className="font-rd-mono tabular-nums text-rd-green">
                {quote.platformFee.bps} bps ({quote.platformFee.amountBase} base)
                {!isPlatformFeeConfigured() ? (
                  <span className="ml-1 text-xs text-rd-caution">(fee account not configured)</span>
                ) : null}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void fetchQuote()}
              className="mt-1 inline-flex items-center gap-1 text-xs text-rd-violet hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Refresh quote
            </button>
          </div>
        ) : null}

        {showCautionBanner ? (
          <div
            className="mt-4 flex gap-2 rounded-rd-sm border border-rd-caution/40 bg-rd-caution/10 px-3 py-2.5 text-sm text-rd-caution"
            role="alert"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            CAUTION — elevated risk signals detected. Proceed only if you accept the risk.
          </div>
        ) : null}

        {hardBlocked && swapDecision?.blockedReason ? (
          <p className="mt-4 rounded-rd-sm border border-rd-danger/40 bg-rd-danger/10 px-3 py-2 text-sm text-rd-danger">
            {swapDecision.blockedReason}
          </p>
        ) : null}

        {needsDangerAck ? (
          <button
            type="button"
            onClick={() => setDangerModalOpen(true)}
            className="mt-4 w-full rounded-rd-sm border border-rd-danger/50 bg-rd-danger/10 px-4 py-3 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider text-rd-danger"
          >
            Acknowledge danger to enable swap
          </button>
        ) : (
          <button
            type="button"
            disabled={swapDisabled}
            onClick={() => void onExecuteSwap()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-rd-sm bg-rd-green px-4 py-3 font-rd-display text-[0.65rem] font-bold uppercase tracking-[0.12em] text-rd-navy disabled:opacity-45"
          >
            {swapping ? (
              <>
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> Simulating &amp; signing…
              </>
            ) : !wallet.publicKey ? (
              'Connect wallet'
            ) : exitMode ? (
              'Confirm exit swap'
            ) : (
              'Confirm swap'
            )}
          </button>
        )}

        {swapError ? (
          <p className="mt-2 text-sm text-rd-danger" role="alert">
            {swapError}
          </p>
        ) : null}

        {signature ? (
          <div className="mt-4 rounded-rd-sm border border-rd-safe/40 bg-rd-safe/10 p-4">
            <div className="flex items-center gap-2 text-rd-safe">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              <span className="font-rd-display text-xs font-bold uppercase tracking-wider">Swap confirmed</span>
            </div>
            <p className="mt-2 break-all font-rd-mono text-xs text-rd-hi">{signature}</p>
            {feeRecorded ? (
              <p className="mt-1 text-xs text-rd-mid">Fee recorded · id {feeRecorded}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`https://solscan.io/tx/${signature}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-rd-green underline"
              >
                View on Solscan
              </a>
              <Link href={terminalDeepLink()} className="text-xs text-rd-violet underline">
                Scan another
              </Link>
              <Link
                href={`${REVENUE_NAV.overview}?shared=${signature}`}
                className="text-xs text-rd-mid underline"
              >
                Share trade
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <RevenueComplianceNote />

      <DangerAcknowledgeModal
        open={dangerModalOpen}
        typed={dangerTyped}
        onTypedChange={setDangerTyped}
        onConfirm={() => {
          setDangerAcknowledged(true)
          setDangerModalOpen(false)
        }}
        onClose={() => setDangerModalOpen(false)}
      />
    </div>
  )
}

async function checkSufficientBalance(
  connection: ReturnType<typeof useConnection>['connection'],
  owner: PublicKey,
  inputMint: string,
  requiredBase: string,
  _tokenDecimals = 6,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const need = BigInt(requiredBase)
  if (need <= 0n) return { ok: false, message: 'Invalid swap amount.' }

  try {
    if (inputMint === SOL_MINT) {
      const lamports = await connection.getBalance(owner)
      const reserve = 5000n
      if (BigInt(lamports) < need + reserve) {
        return { ok: false, message: 'Insufficient SOL balance (keep ~0.000005 SOL for fees).' }
      }
      return { ok: true }
    }

    const ata = await getAssociatedTokenAddress(new PublicKey(inputMint), owner)
    const acc = await connection.getTokenAccountBalance(ata).catch(() => null)
    const have = acc?.value?.amount ? BigInt(acc.value.amount) : 0n
    if (have < need) {
      const label = inputMint === USDC_MINT ? 'USDC' : 'token'
      return { ok: false, message: `Insufficient ${label} balance.` }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Could not verify wallet balance.' }
  }
}
