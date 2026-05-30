'use client'

import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
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
} from './pump-curve'
import type { DeployForm, DiscoverFilter, Side, TerminalView, Timeframe, TradeRow } from './terminal-types'
import { WEB4_BASE_PATH } from '@/lib/web4/routes'
import type { ToastItem } from './components/terminal-primitives'
import { useSolBalanceWs } from '@/lib/web4/hooks/use-sol-balance-ws'
import { useSolPriceWs } from '@/lib/web4/hooks/use-sol-price-ws'
import { useTransactionLifecycle } from '@/lib/web4/hooks/use-transaction-lifecycle'
import { useProgramLogsWs } from '@/lib/web4/hooks/use-program-logs-ws'
import { useTokenBalanceWs } from '@/lib/web4/hooks/use-token-balance-ws'
import { tradeRowFromLogs } from '@/lib/web4/protocol/parse-trade-logs'
import {
  buyOnChain,
  createPoolOnChain,
  graduatePoolOnChain,
  sellOnChain,
} from '@/lib/web4/protocol/client'
import { isWeb4ProgramConfigured } from '@/lib/web4/protocol/config'
import { fetchAllPools } from '@/lib/web4/protocol/fetch-pools'
import { poolPda } from '@/lib/web4/protocol/pda'
import { poolSnapshotToToken } from '@/lib/web4/protocol/pool-mapper'
import {
  bootTerminal,
  fmt,
  fmtCompact,
  generateCandles,
  makeTradeRow,
  pushCandle,
  tokenToCard,
  tokensForSolOut,
  uid,
} from './terminal-utils'

const PRODUCTION = isWeb4ProgramConfigured()

export function usePumpTerminal() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { connection } = useConnection()
  const wallet = useWallet()
  const boot = useMemo(() => bootTerminal(PRODUCTION), [])

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
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({})
  const { tokenBalance: chainTokenBalance, refresh: refreshTokenBalance } =
    useTokenBalanceWs(PRODUCTION ? activeMint : null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [flashTradeId, setFlashTradeId] = useState<string | null>(null)

  const { solBalance, refresh: refreshBalance } = useSolBalanceWs()
  const solUsd = useSolPriceWs()
  const { lifecycle, onLifecycle, reset: resetTx, label: txLabel, busy: txBusy } =
    useTransactionLifecycle()
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

  const syncPoolsFromChain = useCallback(async () => {
    if (!PRODUCTION) return
    try {
      const pools = await fetchAllPools(connection)
      const map: Record<string, ReturnType<typeof poolSnapshotToToken>> = {}
      pools.forEach((p, i) => {
        map[p.mint] = poolSnapshotToToken(p, i)
      })
      setTokens(map)
      if (!activeMint && pools[0]) setActiveMint(pools[0].mint)
    } catch {
      pushToast({ kind: 'info', title: 'Could not sync pools from chain' })
    }
  }, [connection, pushToast])

  useEffect(() => {
    void syncPoolsFromChain()
  }, [syncPoolsFromChain])

  useProgramLogsWs(
    useCallback(
      (_signature, logs) => {
        const addr = wallet.publicKey?.toBase58() ?? ''
        const row = tradeRowFromLogs(logs, addr, activeMint)
        if (row) {
          setTradeRows((prev) => [row, ...prev].slice(0, 40))
          setFlashTradeId(row.id)
          window.setTimeout(() => setFlashTradeId(null), 400)
        }
        void syncPoolsFromChain()
        void refreshTokenBalance()
      },
      [activeMint, syncPoolsFromChain, refreshTokenBalance, wallet.publicKey],
    ),
  )

  const cards = useMemo(
    () => Object.values(tokens).map((t) => tokenToCard(t, solUsd)),
    [tokens, solUsd],
  )

  const activeToken = activeMint ? tokens[activeMint] : undefined
  const activeCard = cards.find((c) => c.mint === activeMint)
  const heldTokens = PRODUCTION
    ? chainTokenBalance
    : (tokenBalances[activeMint] ?? 0)
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
      if (mint) params.set('mint', mint)
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

  const walletShort = wallet.publicKey?.toBase58().slice(0, 4) ?? shortAddr

  const handleDeploy = useCallback(
    async (form: DeployForm) => {
      if (!isConnected) {
        await connect()
        return
      }

      setDeploying(true)
      resetTx()

      try {
        if (PRODUCTION && wallet.publicKey) {
          onLifecycle({ phase: 'building', signature: null })
          const { mint, signature } = await createPoolOnChain({
            connection,
            wallet,
            name: form.name,
            symbol: form.ticker,
            description: form.description,
            initialBuySol: form.liquidity,
            onLifecycle,
          })
          await syncPoolsFromChain()
          setCreateOpen(false)
          pushToast({
            kind: 'deploy',
            title: `${form.ticker} deployed on-chain`,
            sub: signature.slice(0, 20),
          })
          openTrade(mint)
          void refreshBalance()
          return
        }

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
        pushToast({
          kind: 'deploy',
          title: `${token.ticker} created (preview)`,
          sub: 'Deploy program for mainnet',
        })
        openTrade(token.mint)
      } catch (e) {
        pushToast({
          kind: 'info',
          title: 'Deploy failed',
          sub: e instanceof Error ? e.message : 'Unknown error',
        })
      } finally {
        setDeploying(false)
        resetTx()
      }
    },
    [
      isConnected,
      connect,
      resetTx,
      wallet,
      connection,
      onLifecycle,
      syncPoolsFromChain,
      pushToast,
      openTrade,
      refreshBalance,
    ],
  )

  const handleExecute = useCallback(async () => {
    if (!activeToken || activeToken.graduated || tradeAmount <= 0) return
    if (!isConnected) {
      await connect()
      return
    }

    const symbol = activeToken.ticker
    resetTx()

    try {
      if (PRODUCTION && wallet.publicKey) {
        onLifecycle({ phase: 'building', signature: null })
        let signature: string

        if (tradeSide === 'buy') {
          if (tradeAmount > solBalance) {
            pushToast({ kind: 'info', title: 'Insufficient SOL' })
            return
          }
          signature = await buyOnChain({
            connection,
            wallet,
            token: activeToken,
            solIn: tradeAmount,
            slippageBps: slippage * 100,
            onLifecycle,
          })
        } else {
          const tokenIn = tokensForSolOut(activeToken, tradeAmount, heldTokens)
          if (tokenIn <= 0) return
          signature = await sellOnChain({
            connection,
            wallet,
            token: activeToken,
            tokenIn,
            slippageBps: slippage * 100,
            onLifecycle,
          })
        }

        await syncPoolsFromChain()
        void refreshBalance()
        pushToast({
          kind: tradeSide,
          title: `${tradeSide === 'buy' ? 'Buy' : 'Sell'} confirmed`,
          sub: signature.slice(0, 20),
        })

        if (progressPct(activeToken) >= 99 && !activeToken.graduated) {
          try {
            await graduatePoolOnChain({
              connection,
              wallet,
              mint: activeMint,
              onLifecycle,
            })
            pushToast({
              kind: 'grad',
              title: `${symbol} graduating to Raydium`,
              sub: 'LP lock bundle submitted',
            })
          } catch {
            /* graduation may be permissionless keeper */
          }
        }
        return
      }

      if (tradeSide === 'buy') {
        if (tradeAmount > solBalance) return
        const { tokensOut, next, price, graduated: grad } = applyBuy(activeToken, tradeAmount)
        if (tokensOut <= 0) return
        setTokens((prev) => ({ ...prev, [activeMint]: next }))
        setTokenBalances((prev) => ({ ...prev, [activeMint]: (prev[activeMint] ?? 0) + tokensOut }))
        pushTrade(makeTradeRow('buy', price, tokensOut, walletShort), price, 'buy')
        pushToast({
          kind: 'buy',
          title: `Bought ${fmt(tokensOut, 0)} ${symbol}`,
          sub: `${fmt(tradeAmount, 4)} SOL`,
        })
        if (grad) {
          pushToast({
            kind: 'grad',
            title: `${symbol} graduated!`,
            sub: `${PUMP_GRADUATION_SOL} SOL — Raydium migration`,
          })
        }
      } else {
        const tokenIn = tokensForSolOut(activeToken, tradeAmount, heldTokens)
        if (tokenIn <= 0) return
        const { solOut, next, price } = applySell(activeToken, tokenIn)
        if (solOut <= 0) return
        setTokens((prev) => ({ ...prev, [activeMint]: next }))
        setTokenBalances((prev) => ({
          ...prev,
          [activeMint]: Math.max(0, (prev[activeMint] ?? 0) - tokenIn),
        }))
        pushTrade(makeTradeRow('sell', price, tokenIn, walletShort), price, 'sell')
        pushToast({
          kind: 'sell',
          title: `Sold ${fmt(tokenIn, 0)} ${symbol}`,
          sub: `Received ${fmt(solOut, 4)} SOL`,
        })
      }
    } catch (e) {
      pushToast({
        kind: 'info',
        title: 'Transaction failed',
        sub: e instanceof Error ? e.message : 'Unknown error',
      })
    } finally {
      resetTx()
    }
  }, [
    activeToken,
    activeMint,
    tradeSide,
    tradeAmount,
    solBalance,
    heldTokens,
    isConnected,
    connect,
    wallet,
    connection,
    slippage,
    pushTrade,
    pushToast,
    walletShort,
    resetTx,
    onLifecycle,
    syncPoolsFromChain,
    refreshBalance,
  ])

  const quickBuy = useCallback(
    (mint: string, sol = 0.1) => {
      openTrade(mint)
      setTradeSide('buy')
      setTradeAmount(sol)
    },
    [openTrade],
  )

  useEffect(() => {
    if (!PRODUCTION || !activeMint) return
    try {
      const mint = new PublicKey(activeMint)
      const [pool] = poolPda(mint)
      const sub = connection.onAccountChange(
        pool,
        () => {
          void syncPoolsFromChain()
        },
        'confirmed',
      )
      return () => {
        void connection.removeAccountChangeListener(sub)
      }
    } catch {
      return undefined
    }
  }, [activeMint, connection, syncPoolsFromChain])

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 200)
    return () => window.clearTimeout(t)
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
    txLifecycle: lifecycle,
    txLabel,
    txBusy,
    productionMode: PRODUCTION,
  }
}
