'use client'

/**
 * Intelligence Swap — decision-aware Jupiter swap surface for AI OS.
 * Reuses /api/revenue/quote + assess-swap + OMS prepare / Jupiter + client-submit.
 * Never invents swap logic; mirrors SecureExecutionPanel execute path.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { VersionedTransaction } from '@solana/web3.js'
import type { Decision } from '@cryptocheck/decision-contracts'
import { DangerAcknowledgeModal, DANGER_ACK_PHRASE } from '@/components/revenue-dashboard/DangerAcknowledgeModal'
import { DEFAULT_SLIPPAGE_BPS } from '@/lib/revenue-dashboard/constants'
import type { SwapQuote } from '@/lib/revenue-dashboard/types'
import { buildJupiterSwapTransaction } from '@/lib/trading/jupiter-client'
import type { SwapDecision } from '@/lib/trading/risk-gated-swap'
import { simulateSerializedSwapTransaction } from '@/lib/services/swap-simulation'
import { sendSignedSwap } from '@/lib/execution/client-submit'
import { useTerminalWallet } from '@/features/terminal-os/wallet/useTerminalWallet'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { resolveRampConfig } from '@/features/terminal-os/money-lifecycle/ramp-links'
import { useExecutionLifecycleBridge } from '@/features/terminal-os/money-lifecycle/execution-lifecycle-bridge'
import { computeMevProtection } from '@/features/execution-desk/lib/mev-score'
import type { ExecutionState } from '@/features/execution-desk/types'
import {
  LARGE_TRADE_PHRASE,
  LARGE_TRADE_USD_THRESHOLD,
  OVERRIDE_PHRASE,
} from '@/features/execution-desk/types'
import type { TokenRow } from '@/features/terminal-os/shared/types'
import type { DecisionTickMeta } from '@/features/ai-os/lib/gateway-phase'
import {
  resolveGatewayDisplayName,
  selectHeroDecision,
  type GatewayHistoryPoint,
} from '@/features/ai-os/lib/gateway-round2'
import { GatewayHeroFlow } from '@/features/ai-os/components/GatewayHeroFlow'
import '../styles.css'
import '../gateway-tos.css'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

function decisionDirection(action: Decision['action']): 'bullish' | 'bearish' | 'neutral' {
  if (action === 'BUY') return 'bullish'
  if (action === 'SELL' || action === 'EXIT') return 'bearish'
  return 'neutral'
}

const SOL_DECIMALS = 9
const DEFAULT_TOKEN_DECIMALS = 6

const CRITICAL_WARNINGS = new Set([
  'HONEYPOT_RISK',
  'MINT_AUTHORITY_ACTIVE',
  'RUGPULL_PATTERN_DETECTED',
])

const EVM_DISPLAY_TOKENS: SwapToken[] = [
  {
    mint: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    chain: 'evm',
  },
]

type SwapToken = {
  mint: string
  symbol: string
  name: string
  chain: 'solana' | 'evm'
  priceUsd?: number
}

const DEFAULT_SOL: SwapToken = {
  mint: SOL_MINT,
  symbol: 'SOL',
  name: 'Solana',
  chain: 'solana',
  priceUsd: 150,
}

function tokenFromRow(row: TokenRow): SwapToken {
  return {
    mint: row.id,
    symbol: row.symbol,
    name: row.name,
    chain: row.chain === 'ethereum' || row.chain === 'bnb' || row.chain === 'base' || row.chain === 'arbitrum'
      ? 'evm'
      : 'solana',
    priceUsd: row.priceUsd > 0 ? row.priceUsd : undefined,
  }
}

function decimalsFor(mint: string): number {
  if (mint === SOL_MINT) return SOL_DECIMALS
  return DEFAULT_TOKEN_DECIMALS
}

function formatBaseAmount(base: string, mint: string): string {
  const n = Number(base) / 10 ** decimalsFor(mint)
  if (!Number.isFinite(n)) return '—'
  if (n < 0.0001) return n.toExponential(2)
  if (n < 1) return n.toFixed(6)
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function stateLabel(s: ExecutionState): string {
  switch (s) {
    case 'building':
      return 'Building'
    case 'simulating':
      return 'Simulating'
    case 'simulation_failed':
      return 'Simulation failed'
    case 'awaiting_signature':
      return 'Sign in wallet'
    case 'broadcasting':
      return 'Broadcasting'
    case 'pending_confirmation':
      return 'Confirming'
    case 'confirmed':
      return 'Confirmed'
    case 'failed':
      return 'Failed'
    case 'reverted':
      return 'Reverted'
  }
}

export type IntelligenceSwapProps = {
  initialBuyMint?: string | null
  initialBuySymbol?: string | null
  defaultAmountUsd?: number
}

export function IntelligenceSwap({
  initialBuyMint,
  initialBuySymbol,
  defaultAmountUsd = 50,
}: IntelligenceSwapProps) {
  const { connection } = useConnection()
  const wallet = useWallet()
  const {
    walletConnected,
    walletAddress,
    walletBalances,
    walletLabel,
    connectSolana,
    isConnecting,
  } = useTerminalWallet()
  const focusedToken = useTerminalOsStore((s) => s.focusedToken)

  const [sellToken, setSellToken] = useState<SwapToken>(DEFAULT_SOL)
  const [buyToken, setBuyToken] = useState<SwapToken | null>(null)
  const [amountUsd, setAmountUsd] = useState(String(defaultAmountUsd))
  const [slippageBps] = useState(DEFAULT_SLIPPAGE_BPS)
  const [pickerOpen, setPickerOpen] = useState<'sell' | 'buy' | null>(null)
  const [pasteMint, setPasteMint] = useState('')
  const [feedTokens, setFeedTokens] = useState<SwapToken[]>([])
  const [userPickedBuy, setUserPickedBuy] = useState(false)

  const [decision, setDecision] = useState<Decision | null>(null)
  const [tickMeta, setTickMeta] = useState<DecisionTickMeta | null>(null)
  const [decisionHistory, setDecisionHistory] = useState<GatewayHistoryPoint[] | null>(null)
  const [avgHoldingMs, setAvgHoldingMs] = useState<number | null>(null)
  const [dnaSampleSize, setDnaSampleSize] = useState<number | null>(null)
  const [tradingStyleSummary, setTradingStyleSummary] = useState<string | null>(null)
  const [decisionLoading, setDecisionLoading] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [missionApproved, setMissionApproved] = useState(false)
  const [simReady, setSimReady] = useState(false)
  const [pendingSwapTx, setPendingSwapTx] = useState<string | null>(null)
  const [pendingOpportunityId, setPendingOpportunityId] = useState<string | null>(null)
  const [heroBootstrapped, setHeroBootstrapped] = useState(false)
  const [swapDecision, setSwapDecision] = useState<SwapDecision | null>(null)
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [execState, setExecState] = useState<ExecutionState>('building')
  const publishExecState = useExecutionLifecycleBridge((s) => s.setExecutionState)
  const publishSignature = useExecutionLifecycleBridge((s) => s.setLastSignature)
  const [signature, setSignature] = useState<string | null>(null)
  const [pendingSince, setPendingSince] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const [dangerOpen, setDangerOpen] = useState(false)
  const [dangerTyped, setDangerTyped] = useState('')
  const [overrideOk, setOverrideOk] = useState(false)
  const [largeTyped, setLargeTyped] = useState('')
  const [largeOk, setLargeOk] = useState(false)

  const quoteSeq = useRef(0)

  const usd = Number(amountUsd)
  const buyMint = buyToken?.mint ?? ''
  const isEvmBuy = buyToken?.chain === 'evm'
  const isEvmSell = sellToken.chain === 'evm'
  const isEvm = isEvmBuy || isEvmSell

  const solPrice =
    sellToken.mint === SOL_MINT && sellToken.priceUsd && sellToken.priceUsd > 0
      ? sellToken.priceUsd
      : buyToken?.mint === SOL_MINT && buyToken.priceUsd && buyToken.priceUsd > 0
        ? buyToken.priceUsd
        : 150

  const sellTokenPrice =
    sellToken.priceUsd && sellToken.priceUsd > 0 ? sellToken.priceUsd : sellToken.mint === SOL_MINT ? solPrice : 1

  const sellAmountHuman = Number.isFinite(usd) && usd > 0 ? usd / sellTokenPrice : 0

  const jitoEnabled =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_EXEC_JITO_ENABLED === 'true'

  const mev = useMemo(
    () =>
      computeMevProtection({
        amountUsd: Number.isFinite(usd) ? usd : 0,
        liquidityUsd: buyToken?.priceUsd ? buyToken.priceUsd * 1000 : 0,
        jitoEnabled,
        chain: 'solana',
      }),
    [usd, buyToken?.priceUsd, jitoEnabled],
  )

  const needsOverride =
    swapDecision?.verdict === 'HIGH_RISK' ||
    Boolean(swapDecision?.warnings?.some((w) => CRITICAL_WARNINGS.has(w)))

  const isLarge = Number.isFinite(usd) && usd >= LARGE_TRADE_USD_THRESHOLD

  const nativeSolUsd = walletBalances?.nativeUsd ?? 0
  const fundingShortfall =
    sellToken.mint === SOL_MINT && Number.isFinite(usd) && usd > nativeSolUsd
      ? Math.round((usd - nativeSolUsd) * 100) / 100
      : 0
  const ramp = useMemo(() => resolveRampConfig(walletAddress), [walletAddress])

  const estimatedTotalUsd = useMemo(() => {
    if (!Number.isFinite(usd) || usd <= 0) return null
    const fee = quote?.platformFee.amountUsd ?? 0
    return usd + fee
  }, [usd, quote?.platformFee.amountUsd])

  // Sync buy token from focusedToken / props only when user hasn't picked and hero not set
  useEffect(() => {
    if (userPickedBuy || heroBootstrapped) return
    const mint = initialBuyMint ?? focusedToken?.id
    const symbol = initialBuySymbol ?? focusedToken?.symbol
    if (!mint) return
    setBuyToken({
      mint,
      symbol: symbol ?? mint.slice(0, 6),
      name: focusedToken?.name ?? symbol ?? 'Token',
      chain:
        focusedToken?.chain && focusedToken.chain !== 'solana' && focusedToken.chain !== 'all'
          ? 'evm'
          : 'solana',
      priceUsd: focusedToken?.priceUsd,
    })
  }, [
    userPickedBuy,
    heroBootstrapped,
    initialBuyMint,
    initialBuySymbol,
    focusedToken?.id,
    focusedToken?.symbol,
    focusedToken?.name,
    focusedToken?.chain,
    focusedToken?.priceUsd,
  ])

  // Load token feed
  useEffect(() => {
    let cancelled = false
    void fetch('/api/terminal-os/feed?resource=tokens&chain=solana&limit=24', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body: { items?: TokenRow[] }) => {
        if (cancelled) return
        const rows = (body.items ?? []).map(tokenFromRow)
        setFeedTokens(rows)
      })
      .catch(() => {
        if (!cancelled) setFeedTokens([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Round 2 §2 — bootstrap hero mint from highest-confidence actionable Decision
  useEffect(() => {
    if (userPickedBuy) return
    let cancelled = false
    const qs = new URLSearchParams({ limit: '16' })
    if (walletAddress) qs.set('wallet', walletAddress)
    void fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((body: { decisions?: Decision[]; tickMeta?: DecisionTickMeta | null }) => {
        if (cancelled) return
        setTickMeta(body.tickMeta ?? null)
        const hero = selectHeroDecision(body.decisions ?? [])
        if (hero?.subject.kind === 'token') {
          const addr = hero.subject.address
          if (addr && addr.length >= 32) {
            setBuyToken({
              mint: addr,
              symbol: hero.subject.symbol,
              name: hero.subject.symbol,
              chain: 'solana',
            })
          }
        }
        setHeroBootstrapped(true)
      })
      .catch(() => {
        if (!cancelled) setHeroBootstrapped(true)
      })
    return () => {
      cancelled = true
    }
  }, [walletAddress, userPickedBuy])

  // Decision + history for buy token (real hist via history=1 — Intelligence Memory)
  useEffect(() => {
    if (!buyMint || isEvmBuy) {
      setDecision(null)
      setDecisionHistory(null)
      return
    }
    let cancelled = false
    setDecisionLoading(true)
    setMissionApproved(false)
    setSimReady(false)
    setPendingSwapTx(null)
    setPendingOpportunityId(null)
    const qs = new URLSearchParams({ token: buyMint, history: '1' })
    if (walletAddress) qs.set('wallet', walletAddress)
    void fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(
        (body: {
          decision?: Decision | null
          tickMeta?: DecisionTickMeta | null
          history?: GatewayHistoryPoint[]
        }) => {
          if (cancelled) return
          setDecision(body.decision ?? null)
          if (body.tickMeta) setTickMeta(body.tickMeta)
          setDecisionHistory(body.history ?? null)
        },
      )
      .catch(() => {
        if (!cancelled) {
          setDecision(null)
          setDecisionHistory(null)
        }
      })
      .finally(() => {
        if (!cancelled) setDecisionLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [buyMint, walletAddress, isEvmBuy])

  // TraderDNA — hold / strategy only when sampleSize ≥ 3 (honest for untrained wallets)
  useEffect(() => {
    if (!walletAddress) {
      setAvgHoldingMs(null)
      setDnaSampleSize(null)
      setTradingStyleSummary(null)
      return
    }
    let cancelled = false
    void fetch(`/api/terminal-os/dna?wallet=${encodeURIComponent(walletAddress)}`, {
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then(
        (body: {
          dna?: {
            avgHoldingMs?: number
            sampleSize?: number
            tradingStyleSummary?: string
          } | null
        }) => {
          if (cancelled) return
          const dna = body.dna
          const n = dna?.sampleSize ?? 0
          setDnaSampleSize(dna ? n : null)
          if (dna && n >= 3 && (dna.avgHoldingMs ?? 0) > 0) {
            setAvgHoldingMs(dna.avgHoldingMs!)
          } else {
            setAvgHoldingMs(null)
          }
          if (dna && n >= 3 && dna.tradingStyleSummary?.trim()) {
            setTradingStyleSummary(dna.tradingStyleSummary.trim())
          } else {
            setTradingStyleSummary(null)
          }
        },
      )
      .catch(() => {
        if (!cancelled) {
          setAvgHoldingMs(null)
          setDnaSampleSize(null)
          setTradingStyleSummary(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [walletAddress])

  // Execution lifecycle bridge
  useEffect(() => {
    publishExecState(execState)
  }, [execState, publishExecState])
  useEffect(() => {
    publishSignature(signature)
  }, [signature, publishSignature])

  useEffect(() => {
    if (execState !== 'pending_confirmation' || pendingSince == null) return
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - pendingSince) / 1000))
    }, 500)
    return () => window.clearInterval(id)
  }, [execState, pendingSince])

  const refreshQuoteAndAssess = useCallback(async () => {
    if (isEvm || !buyMint || buyMint.length < 32 || !Number.isFinite(usd) || usd <= 0) {
      setQuote(null)
      setSwapDecision(null)
      return
    }
    const seq = ++quoteSeq.current
    setQuoteLoading(true)
    setError(null)
    setExecState('building')
    setOverrideOk(false)
    setSimReady(false)
    setPendingSwapTx(null)
    setPendingOpportunityId(null)
    try {
      const [qRes, aRes] = await Promise.all([
        fetch('/api/revenue/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputMint: sellToken.mint,
            outputMint: buyMint,
            amount: sellAmountHuman,
            slippageBps,
          }),
        }),
        fetch('/api/revenue/assess-swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromToken: sellToken.mint,
            toToken: buyMint,
            amountUsd: usd,
            slippageBps,
            walletAddress: wallet.publicKey?.toBase58(),
          }),
        }),
      ])
      if (seq !== quoteSeq.current) return
      const qBody = await qRes.json()
      if (!qRes.ok) throw new Error(qBody.error ?? 'Quote failed')
      setQuote(qBody as SwapQuote)
      if (aRes.ok) {
        setSwapDecision((await aRes.json()) as SwapDecision)
      } else {
        setSwapDecision(null)
      }
    } catch (e) {
      if (seq !== quoteSeq.current) return
      setError(e instanceof Error ? e.message : 'Quote/assess failed')
      setQuote(null)
      setSwapDecision(null)
    } finally {
      if (seq === quoteSeq.current) setQuoteLoading(false)
    }
  }, [isEvm, buyMint, usd, sellToken.mint, sellAmountHuman, slippageBps, wallet.publicKey])

  useEffect(() => {
    const t = window.setTimeout(() => void refreshQuoteAndAssess(), 400)
    return () => window.clearTimeout(t)
  }, [refreshQuoteAndAssess])

  const flipTokens = () => {
    if (!buyToken) return
    const nextSell = buyToken
    const nextBuy = sellToken
    setSellToken(nextSell)
    setBuyToken(nextBuy)
    setQuote(null)
    setSwapDecision(null)
    setOverrideOk(false)
  }

  const selectToken = (side: 'sell' | 'buy', token: SwapToken) => {
    if (side === 'sell') {
      setSellToken(token)
    } else {
      setBuyToken(token)
      setUserPickedBuy(true)
      setMissionApproved(false)
    }
    setPickerOpen(null)
    setPasteMint('')
  }

  const applyPastedMint = (side: 'sell' | 'buy') => {
    const mint = pasteMint.trim()
    if (mint.length < 32) return
    selectToken(side, {
      mint,
      symbol: mint.slice(0, 4) + '…',
      name: 'Custom mint',
      chain: mint.startsWith('0x') ? 'evm' : 'solana',
    })
  }

  /** Build unsigned tx + dry-run. Returns base64 tx on success; never asks wallet. */
  const prepareAndSimulate = async (): Promise<{
    swapTxBase64: string
    opportunityId: string | null
  } | null> => {
    if (!quote || !wallet.publicKey || isEvm) return null
    if (swapDecision?.verdict === 'BLOCKED') {
      setError(swapDecision.blockedReason ?? 'Blocked by Security Scanner')
      return null
    }
    if (needsOverride && !overrideOk) {
      setDangerOpen(true)
      return null
    }
    if (isLarge && !largeOk) {
      setError(`Large trade — type "${LARGE_TRADE_PHRASE}" to continue.`)
      return null
    }

    setError(null)
    setSignature(null)
    setExecState('simulating')

    const amountSol =
      sellToken.mint === SOL_MINT ? sellAmountHuman : usd / solPrice

    let swapTxBase64: string | null = null
    let opportunityId: string | null = null

    const prepRes = await fetch('/api/execution/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mint: buyMint,
        walletAddress: wallet.publicKey.toBase58(),
        amountSol,
        slippageBps,
        strategy: mev.route === 'jito_private' ? 'aggressive' : 'balanced',
        source: 'manual',
        symbol: buyToken?.symbol,
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
        setSimReady(false)
        setError(
          sim.rpcError
            ? `Simulation would revert — ${sim.rpcError}. Refresh quote and retry.`
            : 'Simulation would revert — not sent to wallet.',
        )
        return null
      }
    } else if (!prepRes.ok || !prepBody?.allowed || !prepBody?.swapTransaction) {
      setExecState('simulation_failed')
      setSimReady(false)
      setError(
        typeof prepBody?.blockReason === 'string'
          ? prepBody.blockReason
          : typeof prepBody?.error === 'string'
            ? prepBody.error
            : 'OMS prepare blocked — not sent to wallet.',
      )
      return null
    } else {
      opportunityId = typeof prepBody.opportunityId === 'string' ? prepBody.opportunityId : null
      swapTxBase64 = String(prepBody.swapTransaction)
      const sim = await simulateSerializedSwapTransaction(connection, swapTxBase64)
      if (sim.sellSimulationFailed) {
        setExecState('simulation_failed')
        setSimReady(false)
        setError(
          sim.rpcError
            ? `Simulation would revert — ${sim.rpcError}. Refresh quote and retry.`
            : 'Simulation would revert — not sent to wallet.',
        )
        return null
      }
    }

    if (!swapTxBase64) {
      setExecState('simulation_failed')
      setSimReady(false)
      setError('No unsigned transaction')
      return null
    }

    setPendingSwapTx(swapTxBase64)
    setPendingOpportunityId(opportunityId)
    setSimReady(true)
    setExecState('building')
    return { swapTxBase64, opportunityId }
  }

  const signAndBroadcast = async (swapTxBase64: string, opportunityId: string | null) => {
    if (!wallet.publicKey || !wallet.signTransaction) return

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
    setPendingSwapTx(null)
    setSimReady(false)

    let confirmed = false
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      const st = await connection.getSignatureStatuses([sent.signature])
      const v = st?.value?.[0]
      if (v?.err) {
        setExecState('reverted')
        setError(typeof v.err === 'string' ? v.err : 'Transaction reverted on-chain')
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
      // Kernel capture — every real execution becomes a CapturedTrade event
      if (walletAddress && buyMint && buyToken && Number(amountUsd) > 0) {
        void fetch('/api/terminal-os/captured-trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: walletAddress,
            tokenMint: buyMint,
            tokenSymbol: buyToken.symbol,
            side: 'buy',
            entryPriceUsd: buyToken.priceUsd && buyToken.priceUsd > 0 ? buyToken.priceUsd : 1,
            positionSizeUsd: Number(amountUsd),
            entryWhy: 'Live swap confirmed via Intelligence Swap',
            id: `swap:${sent.signature}`,
          }),
        }).catch(() => {})
      }
    }
  }

  const runSimulateOnly = async () => {
    if (!missionApproved || !quote || !wallet.publicKey || isEvm) return
    try {
      const prepared = await prepareAndSimulate()
      if (prepared) {
        setError(null)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Simulation failed'
      setExecState('simulation_failed')
      setSimReady(false)
      setError(msg)
    }
  }

  const runSignOnly = async () => {
    if (!missionApproved || !simReady || !pendingSwapTx) {
      setError('Run Simulate successfully before Sign.')
      return
    }
    try {
      await signAndBroadcast(pendingSwapTx, pendingOpportunityId)
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

  const executeSwap = async () => {
    if (!quote || !wallet.publicKey || !wallet.signTransaction || isEvm) return
    try {
      const prepared = await prepareAndSimulate()
      if (!prepared) return
      await signAndBroadcast(prepared.swapTxBase64, prepared.opportunityId)
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

  const onApproveAndExecute = () => {
    if (!missionApproved) {
      setMissionApproved(true)
      return
    }
    void executeSwap()
  }

  const onSkipOpportunity = () => {
    const mint =
      decision?.subject.kind === 'token'
        ? decision.subject.address || buyMint
        : buyMint
    if (walletAddress && mint && mint.length >= 32) {
      void fetch('/api/terminal-os/captured-trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          tokenMint: mint,
          tokenSymbol:
            (decision?.subject.kind === 'token' ? decision.subject.symbol : null) ||
            buyToken?.symbol ||
            mint.slice(0, 4),
          side: 'reject',
          wasRejectedOpportunity: true,
          rejectionReasonInferred: 'Gateway Skip — Decision shown, not executed',
          entryWhy: 'Rejected opportunity after Gateway Decision review',
        }),
      }).catch(() => {})
    }
    setMissionApproved(false)
    setSimReady(false)
    setPendingSwapTx(null)
    setError(null)
  }

  const executeDisabled =
    !missionApproved ||
    isEvm ||
    !buyMint ||
    !quote ||
    !wallet.publicKey ||
    execState === 'simulating' ||
    execState === 'awaiting_signature' ||
    execState === 'broadcasting' ||
    execState === 'pending_confirmation' ||
    swapDecision?.verdict === 'BLOCKED' ||
    (needsOverride && !overrideOk)

  const pickerTokens = useMemo(
    () => [DEFAULT_SOL, ...feedTokens, ...EVM_DISPLAY_TOKENS],
    [feedTokens],
  )

  const buyOutputDisplay =
    quote && buyMint ? formatBaseAmount(quote.outputAmountBase, buyMint) : null

  const subjectSymbol =
    decision?.subject.kind === 'token' ? decision.subject.symbol : buyToken?.symbol
  const dir = decision ? decisionDirection(decision.action) : 'neutral'
  const displayName = resolveGatewayDisplayName({ walletLabel })
  const portfolioReviewed = Boolean(walletConnected && walletBalances)

  return (
    <div data-aios data-aios-gateway>
    <section className="aios-section aios-swap" data-delay="2" aria-label="AI Gateway">
      <p className="aios-section-label">AI Gateway</p>

      <div className="aios-swap-card" data-primary-budget="7" data-gw-flow="decision-reason-approve-execute">
        {/* Round 2: Decision → Reason → Approve → Execute (execution rows below after Approve) */}
        <GatewayHeroFlow
          displayName={displayName}
          tickMeta={tickMeta}
          portfolioReviewed={portfolioReviewed}
          decision={decision}
          decisionLoading={decisionLoading}
          history={decisionHistory}
          avgHoldingMs={avgHoldingMs}
          dnaSampleSize={dnaSampleSize}
          tradingStyleSummary={tradingStyleSummary}
          missionApproved={missionApproved}
          onApproveAndExecute={onApproveAndExecute}
          onSkipOpportunity={onSkipOpportunity}
          onSimulate={() => void runSimulateOnly()}
          onSign={() => void runSignOnly()}
          simulateBusy={execState === 'simulating'}
          signBusy={
            execState === 'awaiting_signature' ||
            execState === 'broadcasting' ||
            execState === 'pending_confirmation'
          }
          simReady={simReady}
          evidenceOpen={evidenceOpen}
          onEvidenceToggle={setEvidenceOpen}
          dir={dir}
          subjectSymbol={subjectSymbol}
        />

        {/* Connect stays available before Approve; swap rows unlock after Approve */}
        {!walletConnected ? (
          <button
            type="button"
            className="aios-swap-execute"
            disabled={isConnecting}
            onClick={() => void connectSolana()}
          >
            {isConnecting ? 'Connecting…' : 'Connect wallet'}
          </button>
        ) : null}

        {!missionApproved ? (
          <p className="aios-gw-reasoning" data-gw-await-approve="true">
            Approve & Execute unlocks amount, cost, and Simulate → Sign.
          </p>
        ) : (
          <div data-gw-exec="ready">
            {/* Sell row */}
            <div className="aios-swap-row">
              <div className="aios-swap-row-head">
                <span className="aios-swap-side-label">Sell</span>
                <button
                  type="button"
                  className="aios-swap-token-btn"
                  onClick={() => setPickerOpen(pickerOpen === 'sell' ? null : 'sell')}
                >
                  {sellToken.symbol}
                  <span className="aios-swap-chevron" aria-hidden>
                    ▾
                  </span>
                </button>
              </div>
              <input
                type="number"
                min={0}
                className="aios-swap-amount"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                placeholder="0.00"
                aria-label="Sell amount in USD"
              />
              <p className="aios-swap-equiv">
                ≈ {sellAmountHuman > 0 ? sellAmountHuman.toFixed(4) : '0'} {sellToken.symbol}
              </p>
            </div>

            <button
              type="button"
              className="aios-swap-flip"
              onClick={flipTokens}
              disabled={!buyToken}
              aria-label="Flip sell and buy tokens"
            >
              ⇅
            </button>

            {/* Buy row */}
            <div className="aios-swap-row">
              <div className="aios-swap-row-head">
                <span className="aios-swap-side-label">Buy</span>
                <button
                  type="button"
                  className="aios-swap-token-btn"
                  onClick={() => setPickerOpen(pickerOpen === 'buy' ? null : 'buy')}
                >
                  {buyToken?.symbol ?? 'Select token'}
                  <span className="aios-swap-chevron" aria-hidden>
                    ▾
                  </span>
                </button>
              </div>
              <div
                className="aios-swap-amount aios-swap-amount-readonly"
                aria-label="Estimated buy amount"
              >
                {quoteLoading ? '…' : buyOutputDisplay ?? '—'}
              </div>
              <p className="aios-swap-equiv">
                {buyToken ? buyToken.symbol : 'Pick a token to buy'}
              </p>
            </div>

            {pickerOpen ? (
              <div className="aios-swap-picker" role="listbox">
                <p className="aios-swap-picker-label">Tokens</p>
                <ul className="aios-swap-picker-list">
                  {pickerTokens.map((t) => (
                    <li key={`${t.chain}-${t.mint}`}>
                      <button
                        type="button"
                        role="option"
                        className="aios-swap-picker-item"
                        data-chain={t.chain}
                        onClick={() => selectToken(pickerOpen, t)}
                      >
                        <span className="aios-swap-picker-sym">{t.symbol}</span>
                        <span className="aios-swap-picker-name">{t.name}</span>
                        {t.chain === 'evm' ? (
                          <span className="aios-swap-picker-badge">EVM</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="aios-swap-paste">
                  <input
                    type="text"
                    value={pasteMint}
                    onChange={(e) => setPasteMint(e.target.value)}
                    placeholder="Paste mint address"
                    className="aios-swap-paste-input"
                  />
                  <button
                    type="button"
                    className="aios-swap-paste-btn"
                    onClick={() => applyPastedMint(pickerOpen)}
                  >
                    Use
                  </button>
                </div>
              </div>
            ) : null}

            {/* Estimated total cost — safety floor: always visible before Execute */}
            <div className="aios-swap-cost">
              <span className="aios-swap-cost-label">Estimated total cost</span>
              <span className="aios-swap-cost-value">
                {estimatedTotalUsd != null ? `$${estimatedTotalUsd.toFixed(2)}` : '—'}
                {quote?.platformFee.bps ? (
                  <span className="aios-swap-fee">
                    {' '}
                    incl. platform fee
                    {quote.platformFee.amountUsd != null
                      ? ` ~$${quote.platformFee.amountUsd.toFixed(4)}`
                      : ''}{' '}
                    ({quote.platformFee.bps} bps)
                  </span>
                ) : null}
              </span>
              {quote ? (
                <span className="aios-swap-cost-detail">
                  Impact {quote.priceImpactPct.toFixed(3)}% · Slippage {quote.slippageBps} bps
                </span>
              ) : null}
            </div>

            {swapDecision ? (
              <div className="aios-swap-verdict" data-verdict={swapDecision.verdict.toLowerCase()}>
                <span>
                  Scanner: {swapDecision.verdict} · risk {swapDecision.riskScore}
                </span>
              </div>
            ) : null}

            {walletConnected && fundingShortfall > 0 && ramp.configured && ramp.buyUrl ? (
              <p className="aios-swap-fund">
                SOL balance short by ~${fundingShortfall.toFixed(2)}.{' '}
                <a href={ramp.buyUrl} target="_blank" rel="noreferrer">
                  Fund with card
                </a>{' '}
                — non-custodial, funds go to your wallet.
              </p>
            ) : null}

            {isEvm ? (
              <p className="aios-swap-evm-notice">
                EVM DEX routing not wired — Decision still shown.
              </p>
            ) : null}

            {isLarge && !isEvm ? (
              <label className="aios-swap-large">
                Large trade — type {LARGE_TRADE_PHRASE}
                <input
                  className="aios-swap-large-input"
                  value={largeTyped}
                  onChange={(e) => {
                    setLargeTyped(e.target.value)
                    setLargeOk(e.target.value.trim() === LARGE_TRADE_PHRASE)
                  }}
                  autoComplete="off"
                />
              </label>
            ) : null}

            {walletConnected ? (
              <button
                type="button"
                className="aios-swap-execute"
                disabled={executeDisabled || (isLarge && !largeOk)}
                onClick={() => void executeSwap()}
                data-gw-exec-fallback="true"
              >
                {execState === 'confirmed'
                  ? 'Swap confirmed'
                  : execState !== 'building' &&
                      execState !== 'simulation_failed' &&
                      execState !== 'failed'
                    ? stateLabel(execState)
                    : 'Execute (Simulate → Sign)'}
              </button>
            ) : null}

            {needsOverride && !overrideOk && swapDecision?.verdict !== 'BLOCKED' && !isEvm ? (
              <button
                type="button"
                className="aios-swap-override"
                onClick={() => setDangerOpen(true)}
              >
                Acknowledge high risk to proceed
              </button>
            ) : null}

            {error ? <p className="aios-swap-error">{error}</p> : null}

            {execState === 'pending_confirmation' && signature ? (
              <p className="aios-swap-status">
                Elapsed {elapsed}s ·{' '}
                <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer">
                  View on explorer
                </a>
              </p>
            ) : null}

            {execState === 'confirmed' && signature ? (
              <p className="aios-swap-success">
                <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer">
                  {signature.slice(0, 8)}…{signature.slice(-8)}
                </a>
              </p>
            ) : null}
          </div>
        )}

        <p className="aios-swap-compliance">Not financial advice · DYOR · Non-custodial</p>
      </div>

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
    </div>
  )
}
