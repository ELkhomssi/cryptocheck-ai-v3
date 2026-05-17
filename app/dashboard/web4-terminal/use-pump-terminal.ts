'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSolana } from '@/components/SolanaProvider'
import {
  EMOJIS,
  GRADIENTS,
  MAD_PER_USD,
  PUMP_GRADUATION_SOL,
  applyBuy,
  applySell,
  createBondingToken,
  priceSol,
  progressPct,
  quoteBuy,
  quoteSell,
  randomBotWallet,
} from './pump-curve'
import type { DeployForm, DiscoverFilter, Side, TerminalView, Timeframe, TradeRow } from './terminal-types'
import { WEB4_BASE_PATH } from '@/lib/web4/routes'
import type { ToastItem } from './components/terminal-primitives'
import {
  DEFAULT_SOL,
  USER_WALLET,
  bootTerminal,
  fmt,
  fmtCompact,
  generateCandles,
  makeTradeRow,
  pushCandle,
  rand,
  tokenToCard,
  tokensForSolOut,
  uid,
} from './terminal-utils'

export function usePumpTerminal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const boot = useMemo(() => bootTerminal(), [])

  const [tokens, setTokens] = useState(boot.tokens)
  const [view, setView] = useState<TerminalView>(() => {
    const v = searchParams.get('view')
    if (v === 'trade' || v === 'trending' || v === 'trenches') return v
    return 'discover'
  })
  const [activeMint, setActiveMint] = useState(() => {
    const m = searchParams.get('mint')
    return m && boot.tokens[m] ? m : boot.firstMint
  })
  const [filter, setFilter] = useState<DiscoverFilter>('live')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [candles, setCandles] = useState(boot.candles)
  const [tradeRows, setTradeRows] = useState<TradeRow[]>([])
  const [timeframe, setTimeframe] = useState<Timeframe>('5m')
  const [tradeSide, setTradeSide] = useState<Side>('buy')
  const [tradeAmount, setTradeAmount] = useState(0.5)
  const [slippage, setSlippage] = useState(1)
  const [launchLiquidity, setLaunchLiquidity] = useState(5)
  const [deploying, setDeploying] = useState(false)
  const [solBalance, setSolBalance] = useState(DEFAULT_SOL)
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({})
  const [solUsd, setSolUsd] = useState(168)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [flashTradeId, setFlashTradeId] = useState<string | null>(null)

  const { isConnected, isConnecting, shortAddr, connect, disconnect } = useSolana()

  const pushToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = uid()
    setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 5))
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const cards = useMemo(
    () => Object.values(tokens).map((t) => tokenToCard(t, solUsd)),
    [tokens, solUsd],
  )

  const activeToken = tokens[activeMint]
  const activeCard = cards.find((c) => c.mint === activeMint)
  const heldTokens = tokenBalances[activeMint] ?? 0
  const priceSolLive = activeToken ? priceSol(activeToken) : 0
  const priceUsd = priceSolLive * solUsd

  const estimatedOutput = useMemo(() => {
    if (!activeToken || tradeAmount <= 0) return 0
    if (tradeSide === 'buy') return quoteBuy(activeToken, tradeAmount) * (1 - slippage / 100)
    const sellAmt = tokensForSolOut(activeToken, tradeAmount, heldTokens)
    return quoteSell(activeToken, sellAmt) * (1 - slippage / 100)
  }, [activeToken, tradeSide, tradeAmount, slippage, heldTokens])

  const outputUnit = tradeSide === 'buy' ? ('tokens' as const) : ('SOL' as const)

  const portfolioUsd = useMemo(() => {
    const solVal = solBalance * solUsd
    const tokenVal = Object.entries(tokenBalances).reduce((acc, [mint, bal]) => {
      const t = tokens[mint]
      if (!t || bal <= 0) return acc
      return acc + bal * priceSol(t) * solUsd
    }, 0)
    return solVal + tokenVal
  }, [solBalance, solUsd, tokenBalances, tokens])

  const maxSellSol = useMemo(() => {
    if (!activeToken || heldTokens <= 0) return 0
    return quoteSell(activeToken, heldTokens)
  }, [activeToken, heldTokens])

  const filteredCards = useMemo(() => {
    let list = [...cards]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.ticker.toLowerCase().includes(q) ||
          c.mint.toLowerCase().includes(q),
      )
    }
    switch (filter) {
      case 'movers':
        list.sort((a, b) => b.change24h - a.change24h)
        break
      case 'new':
        list.sort((a, b) => b.createdAt - a.createdAt)
        break
      case 'migrated':
        list = list.filter((c) => c.graduated)
        break
      case 'mayhem':
        list.sort((a, b) => b.volumeSol - a.volumeSol)
        break
      default:
        list = list.filter((c) => !c.graduated)
        list.sort((a, b) => b.createdAt - a.createdAt)
    }
    return list
  }, [cards, filter, search])

  const trenches = useMemo(() => {
    const bonding = cards.filter((c) => !c.graduated)
    return {
      new: bonding.filter((c) => c.progress < 30).sort((a, b) => b.createdAt - a.createdAt),
      soon: bonding.filter((c) => c.progress >= 30 && c.progress < 95).sort((a, b) => b.progress - a.progress),
      migrated: cards.filter((c) => c.graduated),
    }
  }, [cards])

  const syncUrl = useCallback(
    (mint: string, nextView: TerminalView) => {
      const params = new URLSearchParams()
      params.set('view', nextView)
      params.set('mint', mint)
      router.replace(`${WEB4_BASE_PATH}?${params.toString()}`, { scroll: false })
    },
    [router],
  )

  const openTrade = useCallback(
    (mint: string) => {
      if (!tokens[mint]) return
      setActiveMint(mint)
      setView('trade')
      const p = priceSol(tokens[mint]!)
      setCandles(generateCandles(48, p))
      setTradeRows([])
      syncUrl(mint, 'trade')
    },
    [tokens, syncUrl],
  )

  const navigate = useCallback(
    (nextView: TerminalView) => {
      setView(nextView)
      if (nextView === 'trade') syncUrl(activeMint, 'trade')
      else {
        const params = new URLSearchParams()
        params.set('view', nextView)
        router.replace(`${WEB4_BASE_PATH}?${params.toString()}`, { scroll: false })
      }
    },
    [activeMint, router, syncUrl],
  )

  const pushTrade = useCallback((row: TradeRow, nextPrice: number, side: Side) => {
    setTradeRows((prev) => [{ ...row, age: '0s' }, ...prev].slice(0, 40))
    setFlashTradeId(row.id)
    window.setTimeout(() => setFlashTradeId(null), 400)
    setCandles((prev) => pushCandle(prev, nextPrice, side))
  }, [])

  const handleDeploy = useCallback(
    (form: DeployForm) => {
      setDeploying(true)
      const token = createBondingToken({
        name: form.name,
        ticker: form.ticker,
        description: form.description,
        initialLiquiditySol: form.liquidity,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        gradient: GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)],
      })
      setTokens((prev) => ({ ...prev, [token.mint]: token }))
      setCreateOpen(false)
      setDeploying(false)
      pushToast({
        kind: 'deploy',
        title: `${token.ticker} is live`,
        sub: `${form.liquidity} SOL seeded on bonding curve`,
      })
      openTrade(token.mint)
    },
    [openTrade, pushToast],
  )

  const handleExecute = useCallback(() => {
    if (!activeToken || activeToken.graduated || tradeAmount <= 0) return
    const symbol = activeToken.ticker

    if (tradeSide === 'buy') {
      if (tradeAmount > solBalance) return
      const { tokensOut, next, price, graduated: grad } = applyBuy(activeToken, tradeAmount)
      if (tokensOut <= 0) return
      setTokens((prev) => ({ ...prev, [activeMint]: next }))
      setSolBalance((s) => s - tradeAmount)
      setTokenBalances((prev) => ({ ...prev, [activeMint]: (prev[activeMint] ?? 0) + tokensOut }))
      pushTrade(makeTradeRow('buy', price, tokensOut, USER_WALLET), price, 'buy')
      pushToast({
        kind: 'buy',
        title: `Bought ${fmt(tokensOut, 0)} ${symbol}`,
        sub: `${fmt(tradeAmount, 4)} SOL · ${fmtCompact(tradeAmount * solUsd)}`,
      })
      if (grad) {
        pushToast({
          kind: 'grad',
          title: `${symbol} graduated!`,
          sub: `${PUMP_GRADUATION_SOL} SOL raised — Raydium migration`,
        })
      }
    } else {
      const tokenIn = tokensForSolOut(activeToken, tradeAmount, heldTokens)
      if (tokenIn <= 0) return
      const { solOut, next, price } = applySell(activeToken, tokenIn)
      if (solOut <= 0) return
      setTokens((prev) => ({ ...prev, [activeMint]: next }))
      setSolBalance((s) => s + solOut)
      setTokenBalances((prev) => ({
        ...prev,
        [activeMint]: Math.max(0, (prev[activeMint] ?? 0) - tokenIn),
      }))
      pushTrade(makeTradeRow('sell', price, tokenIn, USER_WALLET), price, 'sell')
      pushToast({
        kind: 'sell',
        title: `Sold ${fmt(tokenIn, 0)} ${symbol}`,
        sub: `Received ${fmt(solOut, 4)} SOL`,
      })
    }
  }, [
    activeToken,
    activeMint,
    tradeSide,
    tradeAmount,
    solBalance,
    heldTokens,
    pushTrade,
    pushToast,
    solUsd,
  ])

  const quickBuy = useCallback(
    (mint: string, sol = 0.1) => {
      openTrade(mint)
      setTradeSide('buy')
      setTradeAmount(sol)
    },
    [openTrade],
  )

  const simulateMarketTrade = useCallback(() => {
    setTokens((prev) => {
      const mint = activeMint
      const token = prev[mint]
      if (!token || token.graduated || view !== 'trade') return prev

      const side: Side = Math.random() > 0.48 ? 'buy' : 'sell'
      if (side === 'buy') {
        const solIn = rand(0.04, 1.2)
        const { tokensOut, next, price } = applyBuy(token, solIn, true)
        if (tokensOut <= 0) return prev
        setTradeRows((tr) => [makeTradeRow('buy', price, tokensOut, randomBotWallet()), ...tr].slice(0, 40))
        setCandles((c) => pushCandle(c, price, 'buy'))
        return { ...prev, [mint]: next }
      }
      const tokenIn = rand(500, Math.max(1000, token.tokensSold * 0.002))
      const { next, price, solOut } = applySell(token, tokenIn)
      if (solOut <= 0) return prev
      setTradeRows((tr) => [makeTradeRow('sell', price, tokenIn, randomBotWallet()), ...tr].slice(0, 40))
      setCandles((c) => pushCandle(c, price, 'sell'))
      return { ...prev, [mint]: next }
    })
  }, [activeMint, view])

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 300)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (view !== 'trade') return
    let timeoutId = 0
    const tick = () => {
      simulateMarketTrade()
      timeoutId = window.setTimeout(tick, rand(800, 1500))
    }
    timeoutId = window.setTimeout(tick, rand(800, 1500))
    return () => window.clearTimeout(timeoutId)
  }, [simulateMarketTrade, view])

  useEffect(() => {
    const id = window.setInterval(() => setSolUsd((s) => s * (1 + rand(-0.002, 0.002))), 12000)
    return () => window.clearInterval(id)
  }, [])

  return {
    ready,
    view,
    navigate,
    filter,
    setFilter,
    search,
    setSearch,
    createOpen,
    setCreateOpen,
    tokens,
    cards,
    filteredCards,
    trenches,
    activeMint,
    activeToken,
    activeCard,
    candles,
    tradeRows,
    timeframe,
    setTimeframe,
    tradeSide,
    setTradeSide,
    tradeAmount,
    setTradeAmount,
    slippage,
    setSlippage,
    launchLiquidity,
    setLaunchLiquidity,
    deploying,
    solBalance,
    heldTokens,
    solUsd,
    priceSolLive,
    priceUsd,
    estimatedOutput,
    outputUnit,
    portfolioUsd,
    balanceMad: portfolioUsd * MAD_PER_USD,
    maxSellSol,
    graduated: activeToken?.graduated ?? false,
    curvePct: activeToken ? progressPct(activeToken) : 0,
    handleDeploy,
    handleExecute,
    openTrade,
    quickBuy,
    isConnected,
    isConnecting,
    shortAddr,
    connect,
    disconnect,
    PUMP_GRADUATION_SOL,
    fmt,
    toasts,
    dismissToast,
    flashTradeId,
  }
}
