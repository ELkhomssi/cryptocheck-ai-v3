'use client'

/**
 * Web4 Terminal — CryptoCheck AI flagship trading dashboard.
 * Standalone plug-and-play page: no shared hooks or app components.
 * Real-time UI is simulated client-side; wire API hooks at marked integration points.
 */

import {
  Component,
  Suspense,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useSolana } from '@/components/SolanaProvider'
import { useWeb4TerminalData } from './use-web4-terminal-data'

const DEFAULT_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  base: '#0A0A0A',
  panel: '#111111',
  teal: '#00E5FF',
  emerald: '#10B981',
  red: '#EF4444',
} as const

// ─── Types ───────────────────────────────────────────────────────────────────
type Side = 'buy' | 'sell'
type OrderBookTab = 'all' | 'buys' | 'sells'
type Timeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W'

interface Candle {
  o: number
  h: number
  l: number
  c: number
}

interface OrderRow {
  id: string
  price: number
  amount: number
  total: number
  side: Side
  depth: number
}

interface Memecoin {
  id: string
  mint: string
  name: string
  ticker: string
  emoji: string
  gradient: string
  progress: number
  marketCap: number
  safetyScore?: number
  verdict?: string
}

interface Transaction {
  id: string
  merchant: string
  amount: number
  currency: 'USD' | 'MAD'
  note: string
}

// ─── Utilities ───────────────────────────────────────────────────────────────
const fmt = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

const fmtCompact = (n: number) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${fmt(n, 0)}`
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

const uid = () => Math.random().toString(36).slice(2, 10)

function generateCandles(count: number, basePrice: number): Candle[] {
  const out: Candle[] = []
  let price = basePrice
  for (let i = 0; i < count; i++) {
    const o = price
    const move = rand(-0.08, 0.08) * price
    const c = Math.max(0.00001, o + move)
    const h = Math.max(o, c) + rand(0, 0.04) * price
    const l = Math.min(o, c) - rand(0, 0.04) * price
    out.push({ o, h, l, c })
    price = c
  }
  return out
}

function generateOrderBook(mid: number, levels = 14): OrderRow[] {
  const rows: OrderRow[] = []
  for (let i = 0; i < levels; i++) {
    const spread = (i + 1) * rand(0.0002, 0.0008)
    const amount = rand(120, 4200)
    const buyPrice = mid - spread
    rows.push({
      id: `b-${i}-${uid()}`,
      price: buyPrice,
      amount,
      total: buyPrice * amount,
      side: 'buy',
      depth: rand(0.15, 1),
    })
    const sellPrice = mid + spread
    rows.push({
      id: `s-${i}-${uid()}`,
      price: sellPrice,
      amount: amount * rand(0.8, 1.2),
      total: sellPrice * amount,
      side: 'sell',
      depth: rand(0.15, 1),
    })
  }
  return rows.sort((a, b) => b.price - a.price)
}

const INITIAL_MEMECOINS: Memecoin[] = [
  { id: '1', mint: DEFAULT_MINT, name: 'Bonk', ticker: 'BONK', emoji: '🐕', gradient: 'from-amber-500 to-orange-500', progress: 72.4, marketCap: 842000 },
  { id: '2', mint: 'EKpQGSml4jJeE3yJGk2bCRfFsGPNJMhTqHMLHJNK4p', name: 'dogwifhat', ticker: 'WIF', emoji: '🐕', gradient: 'from-rose-500 to-pink-500', progress: 91.2, marketCap: 2100000 },
  { id: '3', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdCBuHYmW2hr', name: 'Popcat', ticker: 'POPCAT', emoji: '🐱', gradient: 'from-violet-500 to-fuchsia-500', progress: 45.8, marketCap: 390000 },
  { id: '4', mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', name: 'Fartcoin', ticker: 'FARTC', emoji: '💨', gradient: 'from-cyan-500 to-emerald-500', progress: 63.1, marketCap: 615000 },
  { id: '5', mint: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', name: 'MEW', ticker: 'MEW', emoji: '🐱', gradient: 'from-sky-500 to-indigo-500', progress: 88.7, marketCap: 1750000 },
]

const INITIAL_TX: Transaction[] = [
  { id: 't1', merchant: 'Binance Off-Ramp', amount: -420.5, currency: 'USD', note: 'SOL → USD instant' },
  { id: 't2', merchant: 'Carrefour MA', amount: -89.2, currency: 'MAD', note: '1 SOL ≈ 1,842 MAD' },
  { id: 't3', merchant: 'Starbucks', amount: -12.4, currency: 'USD', note: 'Neural routing' },
  { id: 't4', merchant: 'CryptoCheck Rewards', amount: 156.0, currency: 'USD', note: 'Cashback 2.5%' },
  { id: 't5', merchant: 'Uber', amount: -24.8, currency: 'USD', note: 'AI-protected spend' },
]

// ─── Visual primitives ───────────────────────────────────────────────────────
function TerminalBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      aria-hidden
    >
      <motion.div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,229,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,229,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
        animate={reducedMotion ? undefined : { backgroundPosition: ['0px 0px', '32px 32px'] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,255,0.15) 2px, rgba(0,229,255,0.15) 4px)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#00E5FF]/[0.03] via-transparent to-[#10B981]/[0.02]" />
    </motion.div>
  )
}

function GlassPanel({
  children,
  className = '',
  ...props
}: ComponentProps<'section'>) {
  return (
    <section
      className={`relative overflow-hidden rounded-xl border border-white/10 bg-black/70 shadow-[0_0_15px_rgba(0,229,255,0.08)] backdrop-blur-xl ${className}`}
      {...props}
    >
      {children}
    </section>
  )
}

function ShieldBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#00E5FF]/30 bg-[#00E5FF]/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.25)] ${className}`}
      aria-label="CryptoCheck AI verified"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6l-8-4z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="rgba(0,229,255,0.15)"
        />
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      CryptoCheck
    </span>
  )
}

function Web4WalletChip({
  isConnected,
  isConnecting,
  shortAddr,
  onConnect,
  onDisconnect,
}: {
  isConnected: boolean
  isConnecting: boolean
  shortAddr: string
  onConnect: () => void
  onDisconnect: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      {isConnected ? (
        <>
          <span className="hidden rounded-full border border-[#00E5FF]/30 bg-[#00E5FF]/10 px-2.5 py-1 font-mono text-[0.65rem] text-[#00E5FF] sm:inline">
            {shortAddr}
          </span>
          <button
            type="button"
            onClick={onDisconnect}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
            aria-label="Disconnect wallet"
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void onConnect()}
          disabled={isConnecting}
          className="rounded-lg border border-[#00E5FF]/40 bg-[#00E5FF]/15 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.2)] transition hover:bg-[#00E5FF]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF] disabled:opacity-50"
          aria-label="Connect Solana wallet"
        >
          {isConnecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
      )}
    </div>
  )
}

function ClickGlowButton({
  children,
  onClick,
  variant = 'teal',
  className = '',
  disabled,
  ariaLabel,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'teal' | 'red'
  className?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  const [pulse, setPulse] = useState(false)
  const handleClick = () => {
    if (disabled) return
    setPulse(true)
    setTimeout(() => setPulse(false), 200)
    onClick?.()
  }
  const glow =
    variant === 'teal'
      ? 'shadow-[0_0_30px_rgba(0,229,255,0.35)] hover:shadow-[0_0_40px_rgba(0,229,255,0.5)] bg-gradient-to-r from-[#00E5FF] to-[#00B8D4]'
      : 'shadow-[0_0_30px_rgba(239,68,68,0.35)] hover:shadow-[0_0_40px_rgba(239,68,68,0.5)] bg-gradient-to-r from-red-500 to-red-600'

  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      animate={pulse ? { scale: 0.97 } : { scale: 1 }}
      whileTap={{ scale: 0.95 }}
      className={`w-full rounded-lg px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-black transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-50 ${glow} ${className}`}
    >
      {children}
    </motion.button>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function Web4LoadingSkeleton() {
  return (
    <motion.div
      className="grid min-h-[70vh] gap-4 lg:grid-cols-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="status"
      aria-label="Loading Web4 Terminal"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-96 animate-pulse rounded-xl border border-white/5 bg-[#111111]"
          style={{
            backgroundImage:
              'linear-gradient(90deg, transparent, rgba(0,229,255,0.06), transparent)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      ))}
    </motion.div>
  )
}

// ─── Section A: Launchpad ──────────────────────────────────────────────────────
const MemecoinRow = memo(function MemecoinRow({
  coin,
  active,
  onSelect,
}: {
  coin: Memecoin
  active: boolean
  onSelect: (mint: string) => void
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(coin.mint)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(coin.mint)
        }
      }}
      className={`flex cursor-pointer gap-3 rounded-lg border p-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF] ${
        active
          ? 'border-[#00E5FF]/40 bg-[#00E5FF]/10 shadow-[0_0_15px_rgba(0,229,255,0.15)]'
          : 'border-white/5 bg-white/[0.02] hover:border-[#00E5FF]/20'
      }`}
      aria-label={`Trade ${coin.ticker}`}
      aria-pressed={active}
    >
      <motion.div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${coin.gradient} text-lg shadow-[0_0_15px_rgba(0,229,255,0.2)]`}
        animate={{ rotate: [0, 3, -3, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        {coin.emoji}
      </motion.div>
      <motion.div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-semibold text-white">
            {coin.name}{' '}
            <span className="font-mono text-[#00E5FF]">${coin.ticker}</span>
          </p>
          <span className="shrink-0 font-mono text-[0.65rem] text-[#10B981]">
            {fmtCompact(coin.marketCap)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#00E5FF] to-[#10B981] shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, coin.progress)}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />
        </div>
        <p className="mt-1 font-mono text-[0.6rem] text-white/50">
          {coin.progress.toFixed(1)}% to Raydium
        </p>
      </motion.div>
    </motion.article>
  )
})

const LaunchpadSection = memo(function LaunchpadSection({
  memecoins,
  liquidity,
  onLiquidityChange,
  activeMint,
  onSelectMint,
  feedError,
}: {
  memecoins: Memecoin[]
  liquidity: number
  onLiquidityChange: (v: number) => void
  activeMint: string
  onSelectMint: (mint: string) => void
  feedError: string | null
}) {
  const [tokenName, setTokenName] = useState('')
  const [ticker, setTicker] = useState('')
  const [description, setDescription] = useState('')

  return (
    <GlassPanel className="flex h-full min-h-[520px] flex-col p-4" aria-label="AI-Enforced Safe Launchpad">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-white">AI-Enforced Safe Launchpad</h2>
          <p className="mt-0.5 text-[0.65rem] text-white/50">Pump-grade speed • institutional trust</p>
        </div>
        <ShieldBadge />
      </header>

      <form
        className="space-y-3"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Token launch form"
      >
        <label className="block">
          <span className="mb-1 block text-[0.65rem] font-medium uppercase tracking-wider text-white/60">
            Token Name
          </span>
          <input
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none transition focus:border-[#00E5FF]/50 focus:shadow-[0_0_15px_rgba(0,229,255,0.15)]"
            placeholder="e.g. Neural Pepe"
            aria-label="Token name"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.65rem] font-medium uppercase tracking-wider text-white/60">
            Ticker
          </span>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase().slice(0, 6))}
            maxLength={6}
            className="w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2 font-mono text-sm uppercase text-[#00E5FF] outline-none transition focus:border-[#00E5FF]/50"
            placeholder="NPEPE"
            aria-label="Ticker symbol"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.65rem] font-medium uppercase tracking-wider text-white/60">
            Description
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none transition focus:border-[#00E5FF]/50"
            placeholder="Community-driven AI memecoin..."
            aria-label="Token description"
          />
        </label>
        <div>
          <motion.div className="mb-1 flex items-center justify-between">
            <span className="text-[0.65rem] font-medium uppercase tracking-wider text-white/60">
              Initial Liquidity (SOL)
            </span>
            <span className="font-mono text-sm font-bold text-[#00E5FF]">{liquidity} SOL</span>
          </motion.div>
          <input
            type="range"
            min={1}
            max={50}
            step={0.5}
            value={liquidity}
            onChange={(e) => onLiquidityChange(Number(e.target.value))}
            className="w-full accent-[#00E5FF]"
            aria-label="Initial liquidity in SOL"
          />
          <input
            type="number"
            min={1}
            max={50}
            step={0.5}
            value={liquidity}
            onChange={(e) => onLiquidityChange(Number(e.target.value))}
            className="mt-2 w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-[#00E5FF]/50"
            aria-label="Initial liquidity numeric input"
          />
        </div>
      </form>

      <motion.p
        className="mt-4 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2 text-center text-[0.65rem] font-semibold leading-relaxed text-[#10B981] shadow-[0_0_30px_rgba(16,185,129,0.15)]"
        animate={{ boxShadow: ['0 0 20px rgba(16,185,129,0.1)', '0 0 30px rgba(16,185,129,0.2)', '0 0 20px rgba(16,185,129,0.1)'] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        Auto-Audited by CryptoCheck AI • 100% Mint Authority &amp; Freeze Revoked
      </motion.p>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <h3 className="mb-2 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-white/70">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10B981]" />
          </span>
          Safe Memecoins
          <span className="ml-auto font-mono text-[0.55rem] font-normal normal-case text-white/40">
            DexScreener + Pulse
          </span>
        </h3>
        {feedError ? (
          <p className="mb-2 text-[0.6rem] text-amber-400/90" role="status">
            Feed degraded — showing cached sim data
          </p>
        ) : null}
        <div
          className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1"
          style={{ maxHeight: '220px' }}
          role="feed"
          aria-live="polite"
          aria-label="Live safe memecoins feed"
        >
          <AnimatePresence mode="popLayout">
            {memecoins.map((coin) => (
              <MemecoinRow
                key={coin.id}
                coin={coin}
                active={coin.mint === activeMint}
                onSelect={onSelectMint}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </GlassPanel>
  )
})

// ─── Section B: Market chart ─────────────────────────────────────────────────
const CandlestickChart = memo(function CandlestickChart({
  candles,
  width = 640,
  height = 280,
}: {
  candles: Candle[]
  width?: number
  height?: number
}) {
  const { min, max, paths } = useMemo(() => {
    const lows = candles.map((c) => c.l)
    const highs = candles.map((c) => c.h)
    const minP = Math.min(...lows) * 0.998
    const maxP = Math.max(...highs) * 1.002
    const range = maxP - minP || 1
    const pad = 12
    const cw = (width - pad * 2) / candles.length
    const bodyW = Math.max(2, cw * 0.55)

    const elements = candles.map((c, i) => {
      const x = pad + i * cw + cw / 2
      const y = (p: number) => pad + ((maxP - p) / range) * (height - pad * 2)
      const bullish = c.c >= c.o
      const color = bullish ? C.emerald : C.red
      const bodyTop = y(Math.max(c.o, c.c))
      const bodyBot = y(Math.min(c.o, c.c))
      const bodyH = Math.max(1, bodyBot - bodyTop)
      return (
        <g key={i}>
          <line x1={x} y1={y(c.h)} x2={x} y2={y(c.l)} stroke={color} strokeWidth={1} opacity={0.9} />
          <rect
            x={x - bodyW / 2}
            y={bodyTop}
            width={bodyW}
            height={bodyH}
            fill={color}
            opacity={bullish ? 0.95 : 0.85}
            rx={0.5}
          />
        </g>
      )
    })
    return { min: minP, max: maxP, paths: elements }
  }, [candles, width, height])

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Candlestick chart from ${fmt(min, 6)} to ${fmt(max, 6)} SOL`}
    >
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.teal} stopOpacity={0.12} />
          <stop offset="100%" stopColor={C.teal} stopOpacity={0} />
        </linearGradient>
      </defs>
      {Array.from({ length: 5 }).map((_, i) => {
        const y = 12 + (i / 4) * (height - 24)
        return (
          <line key={i} x1={12} y1={y} x2={width - 12} y2={y} stroke="rgba(255,255,255,0.04)" />
        )
      })}
      <path
        d={`M12 ${height - 12} L${width - 12} ${height - 12} L${width - 12} ${height * 0.4} L12 ${height * 0.55} Z`}
        fill="url(#chartGrad)"
      />
      {paths}
    </svg>
  )
})

const MarketChartSection = memo(function MarketChartSection({
  symbol,
  priceSol,
  priceUsd,
  change24h,
  liquidity,
  volume,
  fdv,
  candles,
  timeframe,
  onTimeframeChange,
  safetyLabel,
  safetySecure,
  marketSource,
  marketError,
  ohlcvSource,
}: {
  symbol: string
  priceSol: number
  priceUsd: number
  change24h: number
  liquidity: number
  volume: number
  fdv: number
  candles: Candle[]
  timeframe: Timeframe
  onTimeframeChange: (t: Timeframe) => void
  safetyLabel: string
  safetySecure: boolean
  marketSource: string | null
  marketError: string | null
  ohlcvSource: string | null
}) {
  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1H', '4H', '1D', '1W']

  return (
    <GlassPanel className="flex min-h-[340px] flex-col p-0" aria-label="Live Web4 market chart">
      <div className="relative flex-1 p-3 pt-2">
        <div className="absolute left-4 right-4 top-3 z-10 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/70 px-4 py-3 backdrop-blur-xl">
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-white/50">
              {symbol} · Current Price
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums text-white md:text-3xl">
              {fmt(priceSol, 6)}{' '}
              <span className="text-base text-[#00E5FF] md:text-lg">SOL</span>
            </p>
            <p className="font-mono text-sm text-white/60">${fmt(priceUsd, 4)}</p>
            {marketSource ? (
              <p className="mt-0.5 font-mono text-[0.55rem] text-white/35">
                via {marketSource}
                {marketError ? ` · ${marketError}` : ''}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-[0.65rem] uppercase tracking-wider text-white/50">24h Change</p>
            <p
              className={`font-mono text-xl font-bold tabular-nums ${
                change24h >= 0 ? 'text-[#10B981] shadow-[0_0_15px_rgba(16,185,129,0.35)]' : 'text-red-400'
              }`}
            >
              {change24h >= 0 ? '+' : ''}
              {change24h.toFixed(1)}%
            </p>
          </div>
          <motion.div className="flex flex-wrap gap-4 text-[0.65rem] md:gap-6">
            {[
              ['Liquidity', fmtCompact(liquidity)],
              ['Volume', fmtCompact(volume)],
              ['FDV', fmtCompact(fdv)],
            ].map(([label, val]) => (
              <div key={label}>
                <span className="text-white/40">{label}</span>
                <p className="font-mono font-semibold text-white">{val}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          className={`absolute right-4 top-24 z-10 max-w-[220px] rounded-lg border bg-black/80 px-2.5 py-2 text-[0.55rem] font-semibold leading-snug backdrop-blur-md md:top-20 md:max-w-none md:text-[0.6rem] ${
            safetySecure
              ? 'border-[#10B981]/40 text-[#10B981] shadow-[0_0_30px_rgba(16,185,129,0.15)]'
              : 'border-amber-500/40 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
          }`}
          animate={
            safetySecure
              ? { borderColor: ['rgba(16,185,129,0.3)', 'rgba(16,185,129,0.6)', 'rgba(16,185,129,0.3)'] }
              : { borderColor: ['rgba(245,158,11,0.3)', 'rgba(245,158,11,0.55)', 'rgba(245,158,11,0.3)'] }
          }
          transition={{ duration: 2.5, repeat: Infinity }}
          role="status"
        >
          <span className="flex items-center gap-1.5">
            <motion.svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              {safetySecure ? (
                <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              )}
            </motion.svg>
            {safetyLabel}
          </span>
        </motion.div>

        <div className="mt-28 h-[220px] md:mt-24 md:h-[260px]">
          <CandlestickChart candles={candles} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-3 py-2">
      <div
        className="flex flex-wrap gap-1"
        role="tablist"
        aria-label="Chart timeframes"
      >
        {timeframes.map((tf) => (
          <button
            key={tf}
            type="button"
            role="tab"
            aria-selected={timeframe === tf}
            onClick={() => onTimeframeChange(tf)}
            className={`rounded-md px-2.5 py-1 font-mono text-[0.65rem] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF] ${
              timeframe === tf
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.25)]'
                : 'text-white/50 hover:bg-white/5 hover:text-white'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
      {ohlcvSource ? (
        <span className="ml-auto font-mono text-[0.55rem] text-white/35">
          candles · {ohlcvSource}
        </span>
      ) : null}
      </div>
    </GlassPanel>
  )
})

// ─── Section C: Order book + Trading ─────────────────────────────────────────
const OrderBookPanel = memo(function OrderBookPanel({
  rows,
  tab,
  onTabChange,
  flashId,
}: {
  rows: OrderRow[]
  tab: OrderBookTab
  onTabChange: (t: OrderBookTab) => void
  flashId: string | null
}) {
  const filtered = useMemo(() => {
    if (tab === 'buys') return rows.filter((r) => r.side === 'buy')
    if (tab === 'sells') return rows.filter((r) => r.side === 'sell')
    return rows
  }, [rows, tab])

  const tabs: { id: OrderBookTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'buys', label: 'Buys' },
    { id: 'sells', label: 'Sells' },
  ]

  return (
    <GlassPanel className="flex h-full min-h-[280px] flex-col p-3" aria-label="Order book">
      <motion.div className="mb-2 flex gap-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTabChange(t.id)}
            className={`rounded px-2 py-1 text-[0.65rem] font-semibold uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF] ${
              tab === t.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </motion.div>
      <div className="mb-1 grid grid-cols-3 font-mono text-[0.55rem] uppercase text-white/40">
        <span>Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>
      <div className="flex-1 overflow-y-auto" role="log" aria-live="polite" aria-label="Order book entries">
        <AnimatePresence initial={false}>
          {filtered.slice(0, 16).map((row) => (
            <motion.div
              key={row.id}
              layout
              initial={{ opacity: 0.4 }}
              animate={{
                opacity: 1,
                backgroundColor:
                  flashId === row.id
                    ? row.side === 'buy'
                      ? 'rgba(16,185,129,0.25)'
                      : 'rgba(239,68,68,0.25)'
                    : 'transparent',
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative grid grid-cols-3 py-0.5 font-mono text-[0.65rem] tabular-nums"
            >
              <div
                className={`absolute inset-y-0 right-0 opacity-20 ${
                  row.side === 'buy' ? 'bg-[#10B981]' : 'bg-red-500'
                }`}
                style={{ width: `${row.depth * 45}%` }}
                aria-hidden
              />
              <span className={row.side === 'buy' ? 'text-[#10B981]' : 'text-red-400'}>
                {fmt(row.price, 6)}
              </span>
              <span className="relative text-right text-white/80">{fmt(row.amount, 0)}</span>
              <span className="relative text-right text-white/50">{fmt(row.total, 2)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </GlassPanel>
  )
})

const TradingConsole = memo(function TradingConsole({
  side,
  onSideChange,
  amountSol,
  onAmountChange,
  estimatedTokens,
  slippage,
  onSlippageChange,
  onExecute,
  maxSol,
}: {
  side: Side
  onSideChange: (s: Side) => void
  amountSol: number
  onAmountChange: (n: number) => void
  estimatedTokens: number
  slippage: number
  onSlippageChange: (n: number) => void
  onExecute: () => void
  maxSol: number
}) {
  const quickAmounts = [0.25, 0.5, 1, 2, 5]

  return (
    <GlassPanel className="flex h-full min-h-[280px] flex-col p-4" aria-label="Trading console">
      <div
        className="mb-4 flex rounded-lg border border-white/10 bg-[#0A0A0A] p-1"
        role="group"
        aria-label="Buy or sell"
      >
        {(['buy', 'sell'] as Side[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSideChange(s)}
            aria-pressed={side === s}
            className={`flex-1 rounded-md py-2.5 text-sm font-bold uppercase tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF] ${
              side === s
                ? s === 'buy'
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.25)]'
                  : 'bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-[0.65rem] uppercase tracking-wider text-white/50">
          Amount (SOL)
        </span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={amountSol}
          onChange={(e) => onAmountChange(Number(e.target.value) || 0)}
          className="w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2 font-mono text-lg text-white outline-none focus:border-[#00E5FF]/50"
          aria-label="Trade amount in SOL"
        />
      </label>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {quickAmounts.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onAmountChange(q)}
            className="rounded-md border border-white/10 px-2 py-1 font-mono text-[0.65rem] text-white/70 transition hover:border-[#00E5FF]/40 hover:text-[#00E5FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
          >
            {q}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onAmountChange(Math.max(0, maxSol * 0.98))}
          className="rounded-md border border-[#00E5FF]/30 px-2 py-1 font-mono text-[0.65rem] font-bold text-[#00E5FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
          aria-label={`Use maximum ${maxSol.toFixed(2)} SOL`}
        >
          MAX
        </button>
      </div>

      <p className="mb-3 font-mono text-[0.7rem] text-white/60">
        Est. output:{' '}
        <span className="text-[#10B981]">{fmt(estimatedTokens, 0)} tokens</span>
      </p>

      <label className="mb-4 block">
        <span className="mb-1 block text-[0.65rem] uppercase tracking-wider text-white/50">
          Slippage tolerance
        </span>
        <select
          value={slippage}
          onChange={(e) => onSlippageChange(Number(e.target.value))}
          className="w-full rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2 text-sm text-white outline-none focus:border-[#00E5FF]/50"
          aria-label="Slippage tolerance"
        >
          {[0.5, 1, 2, 5].map((s) => (
            <option key={s} value={s}>
              {s}%
            </option>
          ))}
        </select>
      </label>

      <ClickGlowButton
        variant={side === 'buy' ? 'teal' : 'red'}
        onClick={onExecute}
        ariaLabel={`Execute ${side} swap`}
      >
        Execute AI-Protected Swap
      </ClickGlowButton>
      <p className="mt-2 text-center text-[0.55rem] text-white/40">
        Powered by CryptoCheck Neural Routing
      </p>
    </GlassPanel>
  )
})

// ─── Section D: Debit card hub ─────────────────────────────────────────────────
const DebitCardHub = memo(function DebitCardHub({
  balanceUsd,
  balanceMad,
  transactions,
  walletShort,
  isConnected,
  holdingsCount,
  solBalance,
  portfolioLive,
}: {
  balanceUsd: number
  balanceMad: number
  transactions: Transaction[]
  walletShort: string
  isConnected: boolean
  holdingsCount: number
  solBalance: number
  portfolioLive: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <GlassPanel className="flex h-full min-h-[520px] flex-col p-4" aria-label="CryptoCheck Web4 debit card hub">
      <h2 className="mb-3 text-sm font-bold text-white">Web4 Debit Card</h2>

      <motion.div
        className="perspective-[1000px] mx-auto w-full max-w-[300px]"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <motion.div
          className="relative aspect-[1.586/1] w-full cursor-pointer rounded-2xl border border-white/20 p-5 shadow-[0_0_30px_rgba(0,229,255,0.2)]"
          style={{
            background:
              'linear-gradient(135deg, rgba(17,17,17,0.95) 0%, rgba(10,10,10,0.98) 50%, rgba(0,229,255,0.08) 100%)',
            transformStyle: 'preserve-3d',
          }}
          animate={{
            rotateY: hovered ? 8 : 0,
            rotateX: hovered ? -4 : 0,
            scale: hovered ? 1.02 : 1,
          }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          whileHover={{ boxShadow: '0 0 40px rgba(0,229,255,0.35)' }}
          aria-label="CryptoCheck Web4 debit card"
        >
          <motion.div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 8px,
                rgba(0,229,255,0.08) 8px,
                rgba(0,229,255,0.08) 9px
              )`,
            }}
            animate={{ backgroundPosition: hovered ? ['0px 0px', '20px 20px'] : '0px 0px' }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <motion.div className="flex items-start justify-between">
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#00E5FF]">
                CryptoCheck
              </span>
              <div className="flex -space-x-2" aria-hidden>
                <span className="h-5 w-5 rounded-full bg-red-500 opacity-90" />
                <span className="h-5 w-5 rounded-full bg-amber-500 opacity-90" />
              </div>
            </motion.div>
            <motion.div
              className="h-8 w-11 rounded-md border border-amber-400/50 bg-gradient-to-br from-amber-200/40 to-amber-600/30 shadow-inner"
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 2, repeat: Infinity }}
              aria-hidden
            />
            <div>
              <p className="font-mono text-sm tracking-[0.25em] text-white/90">•••• •••• •••• 4892</p>
              <div className="mt-2 flex justify-between text-[0.65rem] text-white/60">
                <span>{isConnected ? walletShort : 'Guest · Preview'}</span>
                <span>12/28</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <div className="mt-5 space-y-3">
        <div className="rounded-lg border border-white/10 bg-[#0A0A0A]/80 p-3">
          <p className="text-[0.65rem] uppercase tracking-wider text-white/50">
            Instant Spendable Balance
            {portfolioLive ? (
              <span className="ml-1 text-[#10B981]">· Helius + Jupiter</span>
            ) : null}
          </p>
          <motion.p
            key={balanceUsd}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono text-2xl font-bold text-white"
          >
            ${fmt(balanceUsd, 2)}
          </motion.p>
          <p className="font-mono text-sm text-white/50">{fmt(balanceMad, 0)} MAD</p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10B981]" />
          </span>
          <span className="text-[0.65rem] font-semibold text-[#10B981]">
            Off-Ramp Status: Active • Instant Fiat Routing
          </span>
        </div>

        <motion.div>
          <h3 className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-white/60">
            Recent Transactions
          </h3>
          <ul className="max-h-[180px] space-y-2 overflow-y-auto" aria-label="Recent card transactions">
            {transactions.map((tx) => (
              <motion.li
                key={tx.id}
                layout
                className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2"
              >
                <div className="flex justify-between gap-2">
                  <span className="truncate text-xs font-medium text-white">{tx.merchant}</span>
                  <span
                    className={`shrink-0 font-mono text-xs font-semibold ${
                      tx.amount >= 0 ? 'text-[#10B981]' : 'text-white'
                    }`}
                  >
                    {tx.amount >= 0 ? '+' : ''}
                    {tx.currency === 'USD' ? '$' : ''}
                    {fmt(Math.abs(tx.amount), 2)}
                    {tx.currency === 'MAD' ? ' MAD' : ''}
                  </span>
                </div>
                <p className="text-[0.55rem] text-white/40">{tx.note}</p>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </GlassPanel>
  )
})

// ─── Error boundary (inline, standalone) ─────────────────────────────────────
function Web4ErrorBoundaryFixed({ children }: { children: ReactNode }) {
  const [error, setError] = useState<Error | null>(null)
  if (error) {
    return (
      <motion.div
        className="rounded-xl border border-red-500/30 bg-red-950/20 p-6 text-center"
        role="alert"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <p className="font-semibold text-red-400">Web4 Terminal encountered an error</p>
        <p className="mt-1 text-xs text-white/50">{error.message}</p>
        <button
          type="button"
          onClick={() => setError(null)}
          className="mt-3 rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
        >
          Retry
        </button>
      </motion.div>
    )
  }
  return <ErrorCatcher onError={setError}>{children}</ErrorCatcher>
}

class ErrorCatcher extends Component<
  { children: ReactNode; onError: (e: Error) => void },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(err: Error) {
    this.props.onError(err)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

// ─── Main terminal ───────────────────────────────────────────────────────────
function Web4TerminalInner() {
  const reducedMotion = useReducedMotion() ?? false
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialMint =
    searchParams.get('mint') && searchParams.get('mint')!.length >= 32
      ? searchParams.get('mint')!
      : DEFAULT_MINT

  const [activeMint, setActiveMint] = useState(initialMint)
  const [ready, setReady] = useState(false)
  const [priceSol, setPriceSol] = useState(0.000042)
  const [change24h, setChange24h] = useState(0)
  const [symbol, setSymbol] = useState('BONK')
  const [liquidityDisplay, setLiquidityDisplay] = useState(4_200_000)
  const [volume, setVolume] = useState(890_000)
  const [fdv, setFdv] = useState(12_400_000)
  const [launchLiquidity, setLaunchLiquidity] = useState(5)
  const [candles, setCandles] = useState<Candle[]>(() => generateCandles(48, 0.000042))
  const [orderBook, setOrderBook] = useState<OrderRow[]>(() => generateOrderBook(0.000042))
  const [obTab, setObTab] = useState<OrderBookTab>('all')
  const [flashId, setFlashId] = useState<string | null>(null)
  const [memecoins, setMemecoins] = useState<Memecoin[]>(INITIAL_MEMECOINS)
  const [timeframe, setTimeframe] = useState<Timeframe>('5m')
  const [tradeSide, setTradeSide] = useState<Side>('buy')
  const [tradeAmount, setTradeAmount] = useState(1)
  const [slippage, setSlippage] = useState(1)
  const [balanceUsd, setBalanceUsd] = useState(24_891.42)
  const [balanceMad, setBalanceMad] = useState(248_914)
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TX)
  const [solUsd, setSolUsd] = useState(150)

  const {
    walletAddress,
    isConnected,
    isConnecting,
    shortAddr,
    connect,
    disconnect,
  } = useSolana()

  const {
    market,
    safeFeed,
    safety,
    ohlcv,
    ohlcvSource,
    portfolio,
    marketError,
    feedError,
  } = useWeb4TerminalData(activeMint, timeframe, walletAddress)

  const priceAnchorRef = useRef(0.000042)
  const maxTradeSol = portfolio?.solBalance ?? 10

  const priceUsd = priceSol * solUsd
  const priceRef = useRef(priceSol)
  useEffect(() => {
    priceRef.current = priceSol
  }, [priceSol])

  const selectMint = useCallback(
    (mint: string) => {
      setActiveMint(mint)
      const params = new URLSearchParams(searchParams.toString())
      params.set('mint', mint)
      router.replace(`/dashboard/web4-terminal?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const safetyLabel = safety
    ? safety.secure
      ? `NEURAL SAFETY: ${safety.safetyPct.toFixed(1)}% SECURE — NO THREATS`
      : `NEURAL SAFETY: ${safety.safetyPct.toFixed(1)}% — ${safety.verdict.replace('_', ' ')}`
    : 'NEURAL SAFETY: SCANNING…'

  useEffect(() => {
    if (!market) return
    priceAnchorRef.current = market.priceSol
    setPriceSol(market.priceSol)
    setChange24h(market.change24h)
    setSymbol(market.symbol)
    setLiquidityDisplay(market.liquidity)
    setVolume(market.volume)
    setFdv(market.fdv)
    setSolUsd(market.solUsd)
    setOrderBook(generateOrderBook(market.priceSol))
    if (!ohlcv.length) {
      setCandles(generateCandles(48, market.priceSol))
    }
  }, [market, ohlcv.length])

  useEffect(() => {
    if (!ohlcv.length) return
    setCandles(ohlcv.map(({ o, h, l, c }) => ({ o, h, l, c })))
    const last = ohlcv[ohlcv.length - 1]
    if (last) priceAnchorRef.current = last.c
  }, [ohlcv])

  useEffect(() => {
    if (!portfolio) return
    setBalanceUsd(portfolio.totalUsd)
    setBalanceMad(portfolio.totalMad)
  }, [portfolio])

  useEffect(() => {
    if (!safeFeed.length) return
    setMemecoins(
      safeFeed.map((c) => ({
        id: c.id,
        mint: c.mint,
        name: c.name,
        ticker: c.ticker,
        emoji: c.emoji,
        gradient: c.gradient,
        progress: c.progress,
        marketCap: c.marketCap,
        safetyScore: c.safetyScore,
        verdict: c.verdict,
      })),
    )
  }, [safeFeed])
  const estimatedTokens = useMemo(
    () => (tradeAmount / Math.max(priceSol, 1e-9)) * (1 - slippage / 100),
    [tradeAmount, priceSol, slippage],
  )

  // Hydration-safe loading skeleton
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 400)
    return () => window.clearTimeout(t)
  }, [])

  // Micro-tick around live anchor (API refresh every 30s)
  const tickPrice = useCallback(() => {
    setPriceSol((p) => {
      const anchor = priceAnchorRef.current
      const delta = rand(-0.008, 0.008)
      const jittered = Math.max(0.000001, p * (1 + delta))
      const next = anchor > 0 ? jittered * 0.65 + anchor * 0.35 : jittered
      setCandles((prev) => {
        if (!prev.length) return prev
        const copy = [...prev]
        const last = { ...copy[copy.length - 1] }
        last.c = next
        last.h = Math.max(last.h, next, last.o)
        last.l = Math.min(last.l, next, last.o)
        copy[copy.length - 1] = last
        return copy
      })
      setLiquidityDisplay((l) => l * (1 + rand(-0.002, 0.002)))
      setVolume((v) => v * (1 + rand(-0.01, 0.02)))
      setFdv((f) => f * (1 + rand(-0.005, 0.008)))
      return next
    })
  }, [])

  useEffect(() => {
    const id = window.setInterval(tickPrice, 1500)
    return () => window.clearInterval(id)
  }, [tickPrice])

  // Order book refresh — INTEGRATION: /api/orderbook/stream
  useEffect(() => {
    const refresh = () => {
      const next = generateOrderBook(priceRef.current)
      if (next.length > 0) {
        const idx = Math.floor(Math.random() * next.length)
        setFlashId(next[idx].id)
        setTimeout(() => setFlashId(null), 300)
      }
      setOrderBook(next)
    }
    refresh()
    const id = window.setInterval(refresh, 1800)
    return () => window.clearInterval(id)
  }, [])

  // Subtle bonding-curve drift between API polls
  useEffect(() => {
    const id = window.setInterval(() => {
      setMemecoins((coins) =>
        coins.map((c) => ({
          ...c,
          progress: Math.min(99.9, c.progress + rand(0.02, 0.12)),
        })),
      )
    }, 4000)
    return () => window.clearInterval(id)
  }, [])

  const handleExecute = useCallback(() => {
    const jupUrl =
      tradeSide === 'buy'
        ? `https://jup.ag/swap/SOL-${activeMint}`
        : `https://jup.ag/swap/${activeMint}-SOL`
    window.open(jupUrl, '_blank', 'noopener,noreferrer')
    setTransactions((txs) => [
      {
        id: uid(),
        merchant: 'Jupiter · CryptoCheck Routed',
        amount: tradeSide === 'buy' ? -tradeAmount * solUsd : tradeAmount * solUsd * 0.98,
        currency: 'USD',
        note: `${tradeSide.toUpperCase()} ${symbol} via Neural Routing`,
      },
      ...txs.slice(0, 4),
    ])
  }, [tradeSide, tradeAmount, solUsd, activeMint, symbol])

  if (!ready) {
    return (
      <div className="relative min-h-[70vh]" style={{ backgroundColor: C.base }}>
        <TerminalBackdrop reducedMotion={reducedMotion} />
        <Web4LoadingSkeleton />
      </div>
    )
  }

  return (
    <div
      className="relative w-full min-h-[calc(100vh-12rem)] rounded-xl"
      style={{ backgroundColor: C.base, color: '#fff' }}
    >
      <TerminalBackdrop reducedMotion={reducedMotion} />

      <header className="relative z-10 mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.35em] text-[#00E5FF]/80">
            CryptoCheck AI
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Web4 Terminal
          </h1>
          <p className="mt-1 max-w-xl text-sm text-white/50">
            Neural-safe trading • AI launchpad • instant fiat off-ramp
          </p>
        </div>
        <motion.div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#10B981]/40 bg-[#10B981]/10 px-3 py-1 font-mono text-[0.65rem] text-[#10B981]">
            LIVE
          </span>
          <ShieldBadge />
          <Web4WalletChip
            isConnected={isConnected}
            isConnecting={isConnecting}
            shortAddr={shortAddr}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </motion.div>
      </header>

      {/* 4-column professional grid */}
      <motion.div
        className="relative z-10 grid gap-4 lg:grid-cols-12 xl:grid-cols-4"
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.35 }}
      >
        {/* A — Launchpad */}
        <div className="lg:col-span-12 xl:col-span-1">
          <LaunchpadSection
            memecoins={memecoins}
            liquidity={launchLiquidity}
            onLiquidityChange={setLaunchLiquidity}
            activeMint={activeMint}
            onSelectMint={selectMint}
            feedError={feedError}
          />
        </div>

        {/* B + C — Center stack */}
        <motion.div className="flex flex-col gap-4 lg:col-span-12 xl:col-span-2">
          <MarketChartSection
            symbol={symbol}
            priceSol={priceSol}
            priceUsd={priceUsd}
            change24h={change24h}
            liquidity={liquidityDisplay}
            volume={volume}
            fdv={fdv}
            candles={candles}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            safetyLabel={safetyLabel}
            safetySecure={safety?.secure ?? false}
            marketSource={market?.source ?? null}
            marketError={marketError}
            ohlcvSource={ohlcvSource}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <OrderBookPanel
              rows={orderBook}
              tab={obTab}
              onTabChange={setObTab}
              flashId={flashId}
            />
            <TradingConsole
              side={tradeSide}
              onSideChange={setTradeSide}
              amountSol={tradeAmount}
              onAmountChange={setTradeAmount}
              estimatedTokens={estimatedTokens}
              slippage={slippage}
              onSlippageChange={setSlippage}
              onExecute={handleExecute}
              maxSol={maxTradeSol}
            />
          </div>
        </motion.div>

        {/* D — Debit card */}
        <div className="lg:col-span-12 xl:col-span-1">
          <DebitCardHub
            balanceUsd={balanceUsd}
            balanceMad={balanceMad}
            transactions={transactions}
            walletShort={shortAddr}
            isConnected={isConnected}
            holdingsCount={portfolio?.holdingsCount ?? 0}
            solBalance={portfolio?.solBalance ?? 0}
            portfolioLive={!!portfolio}
          />
        </div>
      </motion.div>
    </div>
  )
}

function Web4TerminalSuspenseFallback() {
  return (
    <motion.div className="relative min-h-[70vh]" style={{ backgroundColor: C.base }}>
      <TerminalBackdrop reducedMotion={false} />
      <Web4LoadingSkeleton />
    </motion.div>
  )
}

export default function Web4TerminalPage() {
  return (
    <Web4ErrorBoundaryFixed>
      <Suspense fallback={<Web4TerminalSuspenseFallback />}>
        <Web4TerminalInner />
      </Suspense>
    </Web4ErrorBoundaryFixed>
  )
}
