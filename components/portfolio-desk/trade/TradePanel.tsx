'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { VersionedTransaction } from '@solana/web3.js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { TokenSearch } from '@/components/portfolio-desk/token/TokenSearch'
import type { SwapQuote } from '@/lib/revenue-dashboard/types'
import { buildJupiterSwapTransaction } from '@/lib/trading/jupiter-client'
import type { SwapDecision } from '@/lib/trading/risk-gated-swap'
import type { TradingContext } from '@/types/intelligence-core'
import type { TerminalOrder, TerminalOrderType } from '@/types/portfolio-desk'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const DANGER_PHRASE = 'I understand this token is high risk'

type Side = 'buy' | 'sell'

async function fetchOrders(wallet: string): Promise<TerminalOrder[]> {
  const res = await fetch(`/api/terminal/orders?wallet=${encodeURIComponent(wallet)}`, {
    cache: 'no-store',
  })
  if (!res.ok) return []
  const body = (await res.json()) as { orders?: TerminalOrder[] }
  return body.orders ?? []
}

export function TradePanel({ initialMint = '' }: { initialMint?: string }) {
  const { walletAddress, isConnected, connect } = useSolana()
  const wallet = useWallet()
  const { connection } = useConnection()
  const qc = useQueryClient()

  const [side, setSide] = useState<Side>('buy')
  const [mint, setMint] = useState(initialMint)
  const [amount, setAmount] = useState('0.1')
  const [slippageBps, setSlippageBps] = useState(50)

  const [decision, setDecision] = useState<SwapDecision | null>(null)
  const [assessing, setAssessing] = useState(false)
  const [assessError, setAssessError] = useState<string | null>(null)

  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const [dangerTyped, setDangerTyped] = useState('')
  const [dangerOk, setDangerOk] = useState(false)
  const [cautionAck, setCautionAck] = useState(false)

  const [swapping, setSwapping] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)

  const [orderType, setOrderType] = useState<TerminalOrderType>('limit')
  const [triggerPrice, setTriggerPrice] = useState('')
  const [orderMsg, setOrderMsg] = useState<string | null>(null)

  const assessSeq = useRef(0)
  const quoteSeq = useRef(0)

  useEffect(() => {
    if (initialMint && initialMint !== mint) setMint(initialMint)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from URL/inspect only
  }, [initialMint])

  const inputMint = side === 'buy' ? SOL_MINT : mint.trim()
  const outputMint = side === 'buy' ? mint.trim() : SOL_MINT
  const riskMint = mint.trim()

  const ordersQ = useQuery({
    queryKey: ['terminal-orders', walletAddress],
    queryFn: () => fetchOrders(walletAddress!),
    enabled: Boolean(walletAddress),
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  // Phase 17.3 — Trading context via ContextEngine (not ad-hoc holdings calls here).
  const tradingCtxQ = useQuery({
    queryKey: ['intelligence-core-trading-context', walletAddress],
    queryFn: async () => {
      const res = await fetch(
        `/api/intelligence-core/context?kind=trading&wallet=${encodeURIComponent(walletAddress!)}`,
        { cache: 'no-store' },
      )
      if (!res.ok) return null
      return (await res.json()) as TradingContext
    },
    enabled: Boolean(walletAddress && walletAddress.length >= 32),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!walletAddress || riskMint.length < 32) return
    void fetch('/api/intelligence-core/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: walletAddress,
        actionType: 'token_scanned',
        subjectType: 'token',
        subjectId: riskMint,
      }),
    }).catch(() => {})
  }, [walletAddress, riskMint])

  const runAssess = useCallback(async () => {
    if (riskMint.length < 32) {
      setDecision(null)
      return
    }
    const seq = ++assessSeq.current
    setAssessing(true)
    setAssessError(null)
    setDangerOk(false)
    setDangerTyped('')
    setCautionAck(false)
    try {
      let res = await fetch('/api/trading/assess-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toToken: riskMint,
          fromToken: SOL_MINT,
          amountUsd: Number(amount) * 150,
          slippageBps,
          walletAddress: walletAddress ?? '',
        }),
      })
      if (res.status === 401 || res.status === 403) {
        res = await fetch('/api/revenue/assess-swap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toToken: riskMint,
            fromToken: SOL_MINT,
            amountUsd: Number(amount) * 150,
            slippageBps,
            walletAddress: walletAddress ?? '',
          }),
        })
      }
      const body = (await res.json().catch(() => ({}))) as SwapDecision & { error?: string }
      if (seq !== assessSeq.current) return
      if (!res.ok) {
        setAssessError(body.error || 'Risk assessment failed')
        setDecision(null)
        return
      }
      setDecision(body)
    } catch {
      if (seq === assessSeq.current) setAssessError('Network error during assessment')
    } finally {
      if (seq === assessSeq.current) setAssessing(false)
    }
  }, [riskMint, amount, slippageBps, walletAddress])

  const runQuote = useCallback(async () => {
    if (inputMint.length < 32 || outputMint.length < 32) {
      setQuote(null)
      return
    }
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
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
          inputMint,
          outputMint,
          amount: amt,
          slippageBps,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as SwapQuote & { error?: string }
      if (seq !== quoteSeq.current) return
      if (!res.ok || !body.quote) {
        setQuoteError(body.error || 'Quote failed')
        setQuote(null)
        return
      }
      setQuote(body)
    } catch {
      if (seq === quoteSeq.current) setQuoteError('Network error fetching quote')
    } finally {
      if (seq === quoteSeq.current) setQuoteLoading(false)
    }
  }, [inputMint, outputMint, amount, slippageBps])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void runAssess()
      void runQuote()
    }, 450)
    return () => window.clearTimeout(t)
  }, [runAssess, runQuote])

  const blocked = decision?.verdict === 'BLOCKED' || decision?.allowed === false
  const highRisk = decision?.verdict === 'HIGH_RISK'
  const caution = decision?.verdict === 'CAUTION'
  const dangerFrictionOk =
    !highRisk ||
    dangerOk ||
    dangerTyped.trim().toLowerCase() === DANGER_PHRASE.toLowerCase()
  const canSwap =
    isConnected &&
    Boolean(decision) &&
    !blocked &&
    Boolean(quote?.quote) &&
    !swapping &&
    dangerFrictionOk &&
    (!caution || cautionAck)

  const onSwap = async () => {
    if (!canSwap || !wallet.publicKey || !wallet.signTransaction || !quote?.quote) return
    if (
      highRisk &&
      !dangerOk &&
      dangerTyped.trim().toLowerCase() !== DANGER_PHRASE.toLowerCase()
    ) {
      return
    }
    if (highRisk) setDangerOk(true)

    setSwapping(true)
    setSwapError(null)
    setSignature(null)
    try {
      const feeAccount = quote.platformFee.feeTokenAccount?.trim()
      const swapTxBase64 = await buildJupiterSwapTransaction(
        quote.quote,
        wallet.publicKey.toBase58(),
        feeAccount && quote.platformFee.bps > 0 ? { feeAccount } : undefined,
      )
      const tx = VersionedTransaction.deserialize(Buffer.from(swapTxBase64, 'base64'))
      const signed = await wallet.signTransaction(tx)
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
      })
      setSignature(sig)
    } catch (e) {
      setSwapError(e instanceof Error ? e.message : 'Swap failed')
    } finally {
      setSwapping(false)
    }
  }

  const placeOrder = async () => {
    if (!walletAddress || riskMint.length < 32) return
    setOrderMsg(null)
    const res = await fetch('/api/terminal/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: walletAddress,
        type: orderType,
        inputMint: side === 'buy' ? SOL_MINT : riskMint,
        outputMint: side === 'buy' ? riskMint : SOL_MINT,
        amount: Number(amount),
        triggerPrice: orderType === 'dca' ? null : Number(triggerPrice),
      }),
    })
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      order?: TerminalOrder
    }
    if (!res.ok) {
      setOrderMsg(body.error || 'Failed to place order')
      return
    }
    setOrderMsg(
      `Tracked ${orderType} order created — pending until trigger; you still sign the swap.`,
    )
    void qc.invalidateQueries({ queryKey: ['terminal-orders', walletAddress] })
  }

  const cancelOrder = async (id: string) => {
    if (!walletAddress) return
    await fetch(`/api/terminal/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress, action: 'cancel' }),
    })
    void qc.invalidateQueries({ queryKey: ['terminal-orders', walletAddress] })
  }

  if (!isConnected) {
    return (
      <div className="pd-empty pd-panel">
        <h3>Connect to trade</h3>
        <p>Non-custodial Jupiter swaps — your wallet signs every transaction.</p>
        <button type="button" className="pd-connect" onClick={() => void connect()}>
          Connect Wallet
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="pd-panel" style={{ padding: 18 }}>
        <div className="pd-panel-head" style={{ padding: '0 0 14px', border: 'none' }}>
          <h2>Institutional execution · Jupiter</h2>
          <span style={{ fontSize: 11, color: 'var(--pd-text-faint)' }}>
            Non-custodial · risk-gated
          </span>
        </div>

        {tradingCtxQ.data ? (
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--pd-text-dim)' }}>
            {tradingCtxQ.data.riskExposure.note}
            {tradingCtxQ.data.watchlist.length
              ? ` · ${tradingCtxQ.data.watchlist.length} watched`
              : ''}
            {tradingCtxQ.data.recentScans.length
              ? ` · ${tradingCtxQ.data.recentScans.length} recent scans`
              : ''}
          </p>
        ) : null}

        <div className="pd-tabs" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={`pd-tab${side === 'buy' ? ' is-active' : ''}`}
            onClick={() => setSide('buy')}
          >
            Buy
          </button>
          <button
            type="button"
            className={`pd-tab${side === 'sell' ? ' is-active' : ''}`}
            onClick={() => setSide('sell')}
          >
            Sell
          </button>
        </div>

        <label
          style={{
            display: 'block',
            fontSize: 11,
            color: 'var(--pd-text-faint)',
            marginBottom: 4,
          }}
        >
          Token (search symbol or paste mint)
        </label>
        <div style={{ marginBottom: 12 }}>
          <TokenSearch
            value={mint}
            fillMintOnSelect
            placeholder="Search token or paste mint…"
            onQueryChange={(q) => {
              // Allow pasting a full mint directly into the field
              if (q.trim().length >= 32 && !q.includes(' ')) setMint(q.trim())
            }}
            onSelect={(row) => setMint(row.mint)}
          />
          {mint ? (
            <div
              className="pd-num"
              style={{ marginTop: 6, fontSize: 11, color: 'var(--pd-text-faint)' }}
            >
              Selected · {mint.slice(0, 8)}…{mint.slice(-8)}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--pd-text-faint)',
                marginBottom: 4,
              }}
            >
              Amount ({side === 'buy' ? 'SOL' : 'tokens'})
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--pd-radius)',
                border: '1px solid var(--pd-border)',
                background: 'var(--pd-surface-2)',
                color: 'inherit',
                fontFamily: 'var(--font-ibm-plex-mono), monospace',
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--pd-text-faint)',
                marginBottom: 4,
              }}
            >
              Slippage (bps)
            </label>
            <input
              type="number"
              min={1}
              max={300}
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value) || 50)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--pd-radius)',
                border: '1px solid var(--pd-border)',
                background: 'var(--pd-surface-2)',
                color: 'inherit',
                fontFamily: 'var(--font-ibm-plex-mono), monospace',
              }}
            />
          </div>
        </div>

        <div
          className="pd-panel"
          style={{
            marginTop: 14,
            marginBottom: 0,
            padding: 14,
            borderColor:
              blocked || highRisk
                ? 'var(--pd-negative)'
                : caution
                  ? 'var(--pd-accent)'
                  : 'var(--pd-border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 13 }}>Risk · Quote</strong>
            {assessing || quoteLoading ? (
              <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
            ) : null}
          </div>
          {assessError ? (
            <p style={{ color: 'var(--pd-negative)', fontSize: 12, marginTop: 8 }}>{assessError}</p>
          ) : null}
          {quoteError ? (
            <p style={{ color: 'var(--pd-negative)', fontSize: 12, marginTop: 8 }}>{quoteError}</p>
          ) : null}
          {decision ? (
            <p style={{ fontSize: 12.5, marginTop: 8 }}>
              Verdict <span className="pd-num">{decision.verdict}</span> · score{' '}
              <span className="pd-num">{decision.riskScore}</span>
            </p>
          ) : null}
          {quote ? (
            <ul
              style={{
                fontSize: 12,
                color: 'var(--pd-text-dim)',
                marginTop: 8,
                lineHeight: 1.6,
                paddingLeft: 18,
              }}
            >
              <li>Route: {quote.routeLabel || 'Jupiter'}</li>
              <li>
                Price impact:{' '}
                <span className="pd-num">{quote.priceImpactPct.toFixed(3)}%</span>
              </li>
              <li>
                Slippage: <span className="pd-num">{quote.slippageBps} bps</span>
              </li>
              <li>
                Platform fee:{' '}
                <span className="pd-num">
                  {quote.platformFee.bps} bps
                  {quote.platformFee.amountUsd != null
                    ? ` (≈$${quote.platformFee.amountUsd.toFixed(4)})`
                    : ''}
                </span>
              </li>
              <li>
                Out amount: <span className="pd-num">{quote.outputAmountBase}</span> (base units)
              </li>
            </ul>
          ) : null}

          {caution ? (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: 'var(--pd-accent-soft)',
                borderRadius: 'var(--pd-radius)',
                fontSize: 12,
                color: 'var(--pd-accent-bright)',
              }}
            >
              <AlertTriangle
                className="h-3.5 w-3.5"
                style={{ display: 'inline', marginRight: 6 }}
              />
              CAUTION — elevated risk. Confirm you accept before swapping.
              <label
                style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}
              >
                <input
                  type="checkbox"
                  checked={cautionAck}
                  onChange={(e) => setCautionAck(e.target.checked)}
                />
                I accept the caution warnings
              </label>
            </div>
          ) : null}

          {highRisk && !blocked ? (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: 'var(--pd-negative-soft)',
                borderRadius: 'var(--pd-radius)',
                fontSize: 12,
              }}
            >
              HIGH RISK — type the confirmation phrase to unlock swap:
              <div
                style={{
                  marginTop: 6,
                  fontFamily: 'var(--font-ibm-plex-mono), monospace',
                }}
              >
                {DANGER_PHRASE}
              </div>
              <input
                value={dangerTyped}
                onChange={(e) => setDangerTyped(e.target.value)}
                placeholder="Type phrase exactly"
                style={{
                  width: '100%',
                  marginTop: 8,
                  padding: '8px 10px',
                  borderRadius: 'var(--pd-radius)',
                  border: '1px solid var(--pd-border)',
                  background: 'var(--pd-surface-2)',
                  color: 'inherit',
                }}
              />
            </div>
          ) : null}

          {blocked ? (
            <p style={{ color: 'var(--pd-negative)', fontSize: 12.5, marginTop: 10 }}>
              Swap blocked by risk gate
              {decision?.blockedReason ? `: ${decision.blockedReason}` : '.'}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="pd-connect"
          style={{ width: '100%', marginTop: 14 }}
          disabled={!canSwap}
          onClick={() => void onSwap()}
        >
          {swapping ? 'Signing…' : side === 'buy' ? 'Confirm Buy' : 'Confirm Sell'}
        </button>
        {swapError ? (
          <p style={{ color: 'var(--pd-negative)', fontSize: 12, marginTop: 8 }}>{swapError}</p>
        ) : null}
        {signature ? (
          <p style={{ fontSize: 12, marginTop: 8 }}>
            Sent · <span className="pd-num">{signature.slice(0, 16)}…</span>
          </p>
        ) : null}
        <p className="pd-ask-note" style={{ marginTop: 10 }}>
          Not financial advice · DYOR. CryptoCheck never custody keys.
        </p>
      </section>

      <section className="pd-panel" style={{ padding: 18 }}>
        <div className="pd-panel-head" style={{ padding: '0 0 14px', border: 'none' }}>
          <h2>Tracked orders</h2>
          <span style={{ fontSize: 11, color: 'var(--pd-text-faint)' }}>Poll 15s</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--pd-text-dim)', marginBottom: 12 }}>
          Limit / DCA / TP / SL are tracked only. Cron marks{' '}
          <span className="pd-num">trigger_hit</span> when price condition is met — you still
          sign Jupiter. <span className="pd-num">filled</span> requires a real signature.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as TerminalOrderType)}
            aria-label="Order type"
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--pd-radius)',
              border: '1px solid var(--pd-border)',
              background: 'var(--pd-surface-2)',
              color: 'inherit',
            }}
          >
            <option value="limit">Limit</option>
            <option value="dca">DCA</option>
            <option value="tp">Take profit</option>
            <option value="sl">Stop loss</option>
          </select>
          <input
            type="number"
            min={0}
            step="any"
            value={triggerPrice}
            onChange={(e) => setTriggerPrice(e.target.value)}
            placeholder="Trigger USD"
            disabled={orderType === 'dca'}
            aria-label="Trigger price USD"
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--pd-radius)',
              border: '1px solid var(--pd-border)',
              background: 'var(--pd-surface-2)',
              color: 'inherit',
              fontFamily: 'var(--font-ibm-plex-mono), monospace',
            }}
          />
          <button type="button" className="pd-connect" onClick={() => void placeOrder()}>
            Track order
          </button>
        </div>
        {orderMsg ? (
          <p style={{ fontSize: 12, color: 'var(--pd-text-dim)', marginBottom: 10 }}>{orderMsg}</p>
        ) : null}

        {!ordersQ.data?.length ? (
          <p style={{ fontSize: 12.5, color: 'var(--pd-text-faint)' }}>No tracked orders yet.</p>
        ) : (
          <table className="pd-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th className="num">Amount</th>
                <th className="num">Trigger</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ordersQ.data.map((o) => (
                <tr key={o.id}>
                  <td>{o.type}</td>
                  <td>
                    <span className="pd-num">{o.status}</span>
                  </td>
                  <td className="num">{o.amount}</td>
                  <td className="num">{o.triggerPrice ?? '—'}</td>
                  <td>
                    {(o.status === 'pending' || o.status === 'trigger_hit') && (
                      <button
                        type="button"
                        className="pd-tab"
                        onClick={() => void cancelOrder(o.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
