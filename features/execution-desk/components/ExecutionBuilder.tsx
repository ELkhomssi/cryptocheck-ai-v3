'use client'

import { useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useIntelligenceChart } from '@/features/intelligence-chart/hooks/useIntelligenceChart'
import {
  computeBuilderState,
  defaultSlippageBpsFromLiquidity,
} from '../lib/builder-math'
import type { ExecutionBuilderState, ExecutionSide, OrderType } from '../types'
import { LARGE_TRADE_USD_THRESHOLD } from '../types'

/** ~median recent prioritization fee → USD using SOL price. */
async function estimateFeesUsd(
  connection: ReturnType<typeof useConnection>['connection'],
  solUsd: number,
): Promise<{ gasUsd: number; priorityUsd: number }> {
  const sol = solUsd > 0 ? solUsd : 150
  try {
    const fees = await connection.getRecentPrioritizationFees()
    const sorted = fees
      .map((f) => f.prioritizationFee)
      .filter((n) => Number.isFinite(n) && n >= 0)
      .sort((a, b) => a - b)
    const mid = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : 5_000
    // Assume ~200k CU for a swap · priority micro-lamports/CU → lamports ≈ mid * CU / 1e6
    const priorityLamports = Math.max(mid, 1) * 0.2
    const baseLamports = 5_000
    return {
      gasUsd: (baseLamports / 1e9) * sol,
      priorityUsd: (priorityLamports / 1e9) * sol,
    }
  } catch {
    return { gasUsd: (5_000 / 1e9) * sol, priorityUsd: (50_000 / 1e9) * sol }
  }
}

export function ExecutionBuilder({
  query,
  onBuilderChange,
  presentation = 'default',
}: {
  query: string
  onBuilderChange?: (state: ExecutionBuilderState) => void
  presentation?: 'default' | 'mission'
}) {
  const wallet = useWallet()
  const { connection } = useConnection()
  const { data: bundle } = useIntelligenceChart(query, 'solana')
  const price = bundle?.token.priceUsd ?? 0
  const liq = bundle?.token.liquidityUsd ?? 0
  const solUsd =
    bundle?.token.symbol?.toUpperCase() === 'SOL' && price > 0 ? price : 150
  const mission = presentation === 'mission'
  const symbol = bundle?.token.symbol ?? 'TOKEN'

  const [side, setSide] = useState<ExecutionSide>('buy')
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [amountUsd, setAmountUsd] = useState(50)
  const [slippageBps, setSlippageBps] = useState(100)
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [gasUsd, setGasUsd] = useState(0.02)
  const [priorityUsd, setPriorityUsd] = useState(0.01)

  useEffect(() => {
    if (liq > 0) setSlippageBps(defaultSlippageBpsFromLiquidity(liq))
  }, [liq])

  useEffect(() => {
    let cancelled = false
    void estimateFeesUsd(connection, solUsd).then((f) => {
      if (cancelled) return
      setGasUsd(f.gasUsd)
      setPriorityUsd(f.priorityUsd)
    })
    const id = window.setInterval(() => {
      void estimateFeesUsd(connection, solUsd).then((f) => {
        if (cancelled) return
        setGasUsd(f.gasUsd)
        setPriorityUsd(f.priorityUsd)
      })
    }, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [connection, solUsd])

  const state = useMemo(
    () =>
      computeBuilderState({
        wallet: wallet.publicKey?.toBase58() ?? '',
        token: {
          mint: bundle?.token.id ?? query,
          symbol: bundle?.token.symbol ?? query,
          chain: 'solana',
        },
        side,
        orderType,
        amountUsd,
        slippageToleranceBps: slippageBps,
        gasEstimateUsd: gasUsd,
        priorityFeeUsd: priorityUsd,
        currentPrice: price,
        stopLoss: stopLoss ? Number(stopLoss) : null,
        takeProfit: takeProfit ? Number(takeProfit) : null,
      }),
    [
      wallet.publicKey,
      bundle,
      query,
      side,
      orderType,
      amountUsd,
      slippageBps,
      gasUsd,
      priorityUsd,
      price,
      stopLoss,
      takeProfit,
    ],
  )

  useEffect(() => {
    onBuilderChange?.(state)
  }, [state, onBuilderChange])

  const large = amountUsd >= LARGE_TRADE_USD_THRESHOLD

  if (mission) {
    return (
      <section className="ex-panel ex-panel--mission" aria-label="Quick Trade" data-ex-mission="true">
        <div className="ex-field-row">
          <button
            type="button"
            className="ex-seg"
            data-active={side === 'buy'}
            onClick={() => setSide('buy')}
          >
            Buy
          </button>
          <button
            type="button"
            className="ex-seg"
            data-active={side === 'sell'}
            onClick={() => setSide('sell')}
          >
            Sell
          </button>
        </div>

        <label className="ex-label">
          You Pay (USD)
          <input
            className="ex-input ex-input--lg"
            type="number"
            min={0}
            step={1}
            value={amountUsd}
            onChange={(e) => setAmountUsd(Number(e.target.value) || 0)}
          />
        </label>

        <div className="ex-mission-receive">
          <span className="ex-label">You Receive</span>
          <strong className="tos-num">
            {price > 0
              ? `${state.positionSizeUnits.toPrecision(6)} ${symbol}`
              : 'Waiting for price…'}
          </strong>
          {price > 0 ? (
            <span className="ex-muted">@ ${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
          ) : null}
        </div>

        <label className="ex-label">
          Slippage (bps)
          <input
            className="ex-input"
            type="number"
            min={1}
            max={1000}
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value) || 50)}
          />
        </label>

        <dl className="ex-derived ex-derived--mission">
          <div>
            <dt>Network fee</dt>
            <dd>~${(gasUsd + priorityUsd).toFixed(4)}</dd>
          </div>
          <div>
            <dt>MEV</dt>
            <dd>Protection on</dd>
          </div>
          {large ? (
            <div>
              <dt>Size</dt>
              <dd className="ex-badge ex-badge-warn">Large</dd>
            </div>
          ) : null}
        </dl>
      </section>
    )
  }

  return (
    <section className="ex-panel" aria-label="Execution Builder">
      <header className="ex-panel-head">
        <h2>Execution Builder</h2>
        {large ? <span className="ex-badge ex-badge-warn">Large size</span> : null}
      </header>

      <div className="ex-field-row">
        <button
          type="button"
          className="ex-seg"
          data-active={side === 'buy'}
          onClick={() => setSide('buy')}
        >
          Buy
        </button>
        <button
          type="button"
          className="ex-seg"
          data-active={side === 'sell'}
          onClick={() => setSide('sell')}
        >
          Sell
        </button>
      </div>

      <div className="ex-field-row">
        <button
          type="button"
          className="ex-seg"
          data-active={orderType === 'market'}
          onClick={() => setOrderType('market')}
        >
          Market
        </button>
        <button
          type="button"
          className="ex-seg"
          data-active={orderType === 'limit'}
          onClick={() => setOrderType('limit')}
        >
          Limit
        </button>
      </div>

      <label className="ex-label">
        Amount (USD)
        <input
          className="ex-input"
          type="number"
          min={0}
          step={1}
          value={amountUsd}
          onChange={(e) => setAmountUsd(Number(e.target.value) || 0)}
        />
      </label>

      <label className="ex-label">
        Slippage (bps)
        <input
          className="ex-input"
          type="number"
          min={1}
          max={1000}
          value={slippageBps}
          onChange={(e) => setSlippageBps(Number(e.target.value) || 50)}
        />
      </label>

      <label className="ex-label">
        Stop loss (USD)
        <input
          className="ex-input"
          type="number"
          value={stopLoss}
          placeholder="optional"
          onChange={(e) => setStopLoss(e.target.value)}
        />
      </label>

      <label className="ex-label">
        Take profit (USD)
        <input
          className="ex-input"
          type="number"
          value={takeProfit}
          placeholder="optional"
          onChange={(e) => setTakeProfit(e.target.value)}
        />
      </label>

      <dl className="ex-derived">
        <div>
          <dt>Position size</dt>
          <dd>{state.positionSizeUnits.toPrecision(6)}</dd>
        </div>
        <div>
          <dt>Risk %</dt>
          <dd>{state.riskPct == null ? '—' : `${state.riskPct.toFixed(2)}%`}</dd>
        </div>
        <div>
          <dt>R:R</dt>
          <dd>{state.riskRewardRatio == null ? '—' : state.riskRewardRatio.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Exp. profit</dt>
          <dd className="ex-pos">
            {state.expectedProfitUsd == null ? '—' : `$${state.expectedProfitUsd.toFixed(2)}`}
          </dd>
        </div>
        <div>
          <dt>Exp. loss</dt>
          <dd className="ex-neg">
            {state.expectedLossUsd == null ? '—' : `$${state.expectedLossUsd.toFixed(2)}`}
          </dd>
        </div>
        <div>
          <dt>Total est. cost</dt>
          <dd>${state.totalEstimatedCostUsd.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Gas / priority</dt>
          <dd>
            ${gasUsd.toFixed(4)} / ${priorityUsd.toFixed(4)}
          </dd>
        </div>
      </dl>

      <p className="ex-muted">
        Wallet: {state.wallet ? `${state.wallet.slice(0, 4)}…${state.wallet.slice(-4)}` : 'not connected'}
      </p>
      <p className="ex-disclaimer">Not financial advice · DYOR · Derived fields recompute live.</p>
    </section>
  )
}
