'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { ScanResult } from '@/lib/revenue-dashboard/types'
import { CHART_MODES, type ChartMode } from '@/lib/trading-terminal/constants'
import type { ChartSlotState } from '@/lib/trading-terminal/types'
import {
  emptySlots,
  loadWorkspace,
  saveWorkspace,
} from '@/lib/trading-terminal/workspace-storage'
import {
  cycleWatchlistId,
  loadWatchlists,
  removeWatchlistItem,
  saveWatchlists,
  upsertWatchlistItem,
  type TerminalWatchlist,
  type WatchlistItem,
} from '@/lib/trading-terminal/watchlist-storage'
import type { TerminalDataMode } from '@/lib/trading-terminal/data/types'
import {
  defaultDataMode,
  persistDataMode,
  readStoredDataMode,
} from '@/lib/trading-terminal/data/mode'
import { getDemoSeed } from '@/lib/trading-terminal/data/demo-seed'

function slotCount(mode: ChartMode): number {
  return mode
}

type TerminalFocusApi = {
  hydrated: boolean
  focusMint: string
  focusSymbol: string
  focusSignal: UnifiedSignal | null
  chartMode: ChartMode
  slots: ChartSlotState[]
  activeSlot: number
  scan: ScanResult | null
  scanning: boolean
  scanError: string | null
  ticketSide: 'buy' | 'sell'
  /** demo = labeled DEMO_SEED; live = real feeds + honest empties */
  dataMode: TerminalDataMode
  setDataMode: (m: TerminalDataMode) => void
  coachCollapsed: boolean
  discoverCollapsed: boolean
  positionsOpen: boolean
  discoverHighlight: number
  watchlists: TerminalWatchlist[]
  activeWatchlistId: string
  setChartMode: (m: ChartMode) => void
  setActiveSlot: (i: number) => void
  setTicketSide: (s: 'buy' | 'sell') => void
  /** Ticket size in SOL — drives Portfolio Impact + Trade Plan sizing. */
  ticketAmountSol: number
  setTicketAmountSol: (n: number) => void
  /** Last known SOL/USD for impact math (from ribbon/API). */
  solPriceUsd: number | null
  setSolPriceUsd: (n: number | null) => void
  setCoachCollapsed: (v: boolean) => void
  setDiscoverCollapsed: (v: boolean) => void
  setPositionsOpen: (v: boolean) => void
  setDiscoverHighlight: (i: number) => void
  setActiveWatchlistId: (id: string) => void
  selectMint: (mint: string, symbol?: string) => void
  selectSignal: (signal: UnifiedSignal) => void
  loadMintToSlot: (mint: string, symbol: string, slotIndex: number) => void
  toggleSlotLock: (slotIndex: number) => void
  swapSlots: (a: number, b: number) => void
  runScan: (mint?: string) => Promise<void>
  addToWatchlist: (item: Omit<WatchlistItem, 'addedAt'> & { addedAt?: string }, listId?: string) => void
  removeFromWatchlist: (mint: string, listId?: string) => void
  cycleWatchlist: () => void
  createWatchlist: (name: string) => void
  /** Portfolio total USD for concentration interrupts — set by PortfolioStrip. */
  portfolioTotalUsd: number
  positionValueUsd: (mint: string) => number | null
  setPortfolioSnapshot: (totalUsd: number, positions: Array<{ mint: string; valueUsd: number }>) => void
  /** Focus mint + sell side for quick exit from portfolio strip. */
  armExit: (mint: string, symbol: string) => void
}

const Ctx = createContext<TerminalFocusApi | null>(null)

export function useTerminalFocus(): TerminalFocusApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTerminalFocus must be used within TerminalFocusProvider')
  return v
}

export function TerminalFocusProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const [focusMint, setFocusMint] = useState('')
  const [focusSymbol, setFocusSymbol] = useState('')
  const [focusSignal, setFocusSignal] = useState<UnifiedSignal | null>(null)
  const [chartMode, setChartModeState] = useState<ChartMode>(1)
  const [slots, setSlots] = useState<ChartSlotState[]>(() => emptySlots(1))
  const [activeSlot, setActiveSlot] = useState(0)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [ticketSide, setTicketSide] = useState<'buy' | 'sell'>('buy')
  const [ticketAmountSol, setTicketAmountSol] = useState(0.25)
  const [solPriceUsd, setSolPriceUsd] = useState<number | null>(null)
  const [dataMode, setDataModeState] = useState<TerminalDataMode>(defaultDataMode)
  const [coachCollapsed, setCoachCollapsed] = useState(false)
  const [discoverCollapsed, setDiscoverCollapsed] = useState(false)
  const [positionsOpen, setPositionsOpen] = useState(false)
  const [discoverHighlight, setDiscoverHighlight] = useState(0)
  const [watchlists, setWatchlists] = useState<TerminalWatchlist[]>(() => loadWatchlists().lists)
  const [activeWatchlistId, setActiveWatchlistId] = useState('default')
  const [portfolioTotalUsd, setPortfolioTotalUsd] = useState(0)
  const [positionValues, setPositionValues] = useState<Record<string, number>>({})
  const skipPersist = useRef(true)
  const restoredFocus = useRef<string | null>(null)

  useEffect(() => {
    // Institutional White Terminal: live-only unless explicitly opted into demo via env.
    const envMode =
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_TERMINAL_DATA_MODE : undefined
    if (envMode === 'demo') {
      const stored = readStoredDataMode()
      setDataModeState(stored ?? 'demo')
    } else {
      setDataModeState('live')
      persistDataMode('live')
    }
    const ws = loadWorkspace()
    const wl = loadWatchlists()
    setWatchlists(wl.lists)
    if (ws) {
      // Institutional desk: always primary single-chart workspace
      setChartModeState(1)
      const focusSlot = ws.slots.find((s) => s.mint === ws.focusMint) ?? ws.slots[0]
      setSlots([
        focusSlot ?? {
          mint: ws.focusMint || '',
          symbol: ws.focusSymbol || '',
          locked: false,
        },
      ])
      setActiveSlot(0)
      setFocusMint(ws.focusMint)
      setFocusSymbol(ws.focusSymbol)
      setCoachCollapsed(ws.coachCollapsed)
      setDiscoverCollapsed(ws.discoverCollapsed)
      setActiveWatchlistId(
        wl.lists.some((l) => l.id === ws.activeWatchlistId)
          ? ws.activeWatchlistId
          : wl.lists[0]?.id ?? 'default',
      )
      if (ws.focusMint.length >= 32) restoredFocus.current = ws.focusMint
    }
    setHydrated(true)
    skipPersist.current = false
  }, [])

  const setDataMode = useCallback((m: TerminalDataMode) => {
    setDataModeState(m)
    persistDataMode(m)
  }, [])

  // Apply DEMO_SEED focus + chart slots when entering demo with empty focus
  useEffect(() => {
    if (!hydrated || dataMode !== 'demo') return
    const seed = getDemoSeed()
    setSolPriceUsd(seed.solPriceUsd)
    setPortfolioTotalUsd(seed.portions.totalUsd)
    setPositionValues(
      Object.fromEntries(seed.positions.map((p) => [p.mint, p.valueUsd])),
    )
    if (!focusMint || focusMint.length < 32) {
      setFocusMint(seed.focusMint)
      setFocusSymbol(seed.focusSymbol)
    }
    // Primary chart workspace — single focus slot (institutional desk)
    setChartModeState(1)
    const focus = focusMint && focusMint.length >= 32 ? focusMint : seed.focusMint
    const sym =
      focusSymbol && focusMint && focusMint.length >= 32 ? focusSymbol : seed.focusSymbol
    const chartRow = seed.charts.find((c) => c.mint === focus) ?? seed.charts[0]
    setSlots([
      {
        mint: chartRow?.mint ?? focus,
        symbol: chartRow?.symbol ?? sym,
        locked: false,
      },
    ])
    setActiveSlot(0)
    // demo scan card — synthetic ScanResult shape for coach map
    setScan({
      mint: seed.coach.mint,
      symbol: seed.coach.symbol,
      name: seed.coach.name,
      safetyScore: seed.coach.safetyScore,
      riskScore: seed.coach.riskScore,
      verdict:
        seed.coach.verdict === 'DANGER'
          ? 'DANGER'
          : seed.coach.verdict === 'BLOCKED'
            ? 'DANGER'
            : seed.coach.verdict === 'SAFE'
              ? 'SAFE'
              : 'CAUTION',
      confidence: 'high',
      topSignals: seed.coach.why.map((w, i) => ({
        id: `demo-${i}`,
        label: w.text.slice(0, 40),
        weight: w.direction === 'up' ? 5 : -5,
        detail: w.text,
      })),
      evidenceLine: seed.coach.why[0]?.text ?? 'DEMO_SEED evidence',
      scannedAt: new Date().toISOString(),
      cache: 'miss',
      sample: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply once per mode enter
  }, [hydrated, dataMode])

  useEffect(() => {
    if (!hydrated || skipPersist.current) return
    saveWorkspace({
      chartMode,
      slots,
      activeSlot,
      focusMint,
      focusSymbol,
      coachCollapsed,
      discoverCollapsed,
      activeWatchlistId,
    })
  }, [
    hydrated,
    chartMode,
    slots,
    activeSlot,
    focusMint,
    focusSymbol,
    coachCollapsed,
    discoverCollapsed,
    activeWatchlistId,
  ])

  useEffect(() => {
    if (!hydrated || skipPersist.current) return
    saveWatchlists(watchlists)
  }, [hydrated, watchlists])

  const setChartMode = useCallback((m: ChartMode) => {
    if (!CHART_MODES.includes(m)) return
    setChartModeState(m)
    setSlots((prev) => {
      const next = emptySlots(slotCount(m))
      for (let i = 0; i < Math.min(prev.length, next.length); i++) {
        next[i] = prev[i]!
      }
      return next
    })
    setActiveSlot((i) => Math.min(i, slotCount(m) - 1))
  }, [])

  const runScan = useCallback(async (overrideMint?: string) => {
    const m = (overrideMint ?? focusMint).trim()
    if (m.length < 32) return
    setScanning(true)
    setScanError(null)
    try {
      const res = await fetch('/api/revenue/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: m }),
      })
      const body = (await res.json().catch(() => ({}))) as ScanResult & { error?: string }
      if (!res.ok) {
        setScan(null)
        setScanError(body.error || 'Scan failed — verdict withheld')
        return
      }
      setScan(body)
      // Refresh badges only for mints already on a list — never auto-add on scan.
      setWatchlists((prev) =>
        prev.map((list) => ({
          ...list,
          items: list.items.map((it) =>
            it.mint === body.mint
              ? {
                  ...it,
                  lastVerdict: body.verdict,
                  lastRiskScore: body.riskScore,
                  symbol: body.symbol || it.symbol,
                }
              : it,
          ),
        })),
      )
    } catch {
      setScan(null)
      setScanError('Engine unreachable — verdict withheld')
    } finally {
      setScanning(false)
    }
  }, [focusMint, activeWatchlistId])

  // Restore scan for hydrated focus mint once
  useEffect(() => {
    if (!hydrated || !restoredFocus.current) return
    const m = restoredFocus.current
    restoredFocus.current = null
    void runScan(m)
  }, [hydrated, runScan])

  const applyFocusToActiveSlot = useCallback((mint: string, symbol: string) => {
    setSlots((prev) => {
      const next = [...prev]
      let target = activeSlot
      const cur = next[target]
      if (cur?.locked) {
        const unlocked = next.findIndex((s) => !s.locked)
        if (unlocked >= 0) target = unlocked
        else return prev
      }
      next[target] = {
        mint,
        symbol: symbol || mint.slice(0, 6),
        locked: next[target]?.locked ?? false,
      }
      return next
    })
  }, [activeSlot])

  const selectMint = useCallback(
    (mint: string, symbol = '') => {
      const trimmed = mint.trim()
      if (!trimmed) return
      setFocusMint(trimmed)
      setFocusSymbol(symbol || trimmed.slice(0, 6))
      setFocusSignal(null)
      applyFocusToActiveSlot(trimmed, symbol || trimmed.slice(0, 6))
      if (trimmed.length >= 32) void runScan(trimmed)
    },
    [applyFocusToActiveSlot, runScan],
  )

  const selectSignal = useCallback(
    (signal: UnifiedSignal) => {
      const ca = signal.contractAddress?.trim() ?? ''
      if (!ca) return
      setFocusSignal(signal)
      setFocusMint(ca)
      const sym = signal.tokenSymbol?.trim() || signal.label || ca.slice(0, 6)
      setFocusSymbol(sym)
      applyFocusToActiveSlot(ca, sym)
      void runScan(ca)
    },
    [applyFocusToActiveSlot, runScan],
  )

  const loadMintToSlot = useCallback((mint: string, symbol: string, slotIndex: number) => {
    const trimmed = mint.trim()
    if (!trimmed) return
    setSlots((prev) => {
      if (slotIndex < 0 || slotIndex >= prev.length) return prev
      if (prev[slotIndex]?.locked) return prev
      const next = [...prev]
      next[slotIndex] = {
        mint: trimmed,
        symbol: symbol || trimmed.slice(0, 6),
        locked: false,
      }
      return next
    })
    setActiveSlot(slotIndex)
    setFocusMint(trimmed)
    setFocusSymbol(symbol || trimmed.slice(0, 6))
    setFocusSignal(null)
    if (trimmed.length >= 32) void runScan(trimmed)
  }, [runScan])

  const toggleSlotLock = useCallback((slotIndex: number) => {
    setSlots((prev) => {
      if (slotIndex < 0 || slotIndex >= prev.length) return prev
      const next = [...prev]
      const cur = next[slotIndex]!
      next[slotIndex] = { ...cur, locked: !cur.locked }
      return next
    })
  }, [])

  const swapSlots = useCallback((a: number, b: number) => {
    setSlots((prev) => {
      if (a < 0 || b < 0 || a >= prev.length || b >= prev.length || a === b) return prev
      if (prev[a]?.locked || prev[b]?.locked) return prev
      const next = [...prev]
      const tmp = next[a]!
      next[a] = next[b]!
      next[b] = tmp
      return next
    })
  }, [])

  const addToWatchlist = useCallback(
    (item: Omit<WatchlistItem, 'addedAt'> & { addedAt?: string }, listId?: string) => {
      const id = listId ?? activeWatchlistId
      setWatchlists((prev) => upsertWatchlistItem(prev, id, item))
    },
    [activeWatchlistId],
  )

  const removeFromWatchlist = useCallback(
    (mint: string, listId?: string) => {
      const id = listId ?? activeWatchlistId
      setWatchlists((prev) => removeWatchlistItem(prev, id, mint))
    },
    [activeWatchlistId],
  )

  const cycleWatchlist = useCallback(() => {
    setActiveWatchlistId((cur) => cycleWatchlistId(watchlists, cur))
  }, [watchlists])

  const createWatchlist = useCallback((name: string) => {
    const id = `wl_${Date.now().toString(36)}`
    setWatchlists((prev) => [...prev, { id, name: name.trim().slice(0, 40) || 'List', items: [] }])
    setActiveWatchlistId(id)
  }, [])

  const setPortfolioSnapshot = useCallback(
    (totalUsd: number, positions: Array<{ mint: string; valueUsd: number }>) => {
      setPortfolioTotalUsd(totalUsd)
      const map: Record<string, number> = {}
      for (const p of positions) map[p.mint] = p.valueUsd
      setPositionValues(map)
    },
    [],
  )

  const positionValueUsd = useCallback(
    (mint: string) => {
      const v = positionValues[mint]
      return typeof v === 'number' ? v : null
    },
    [positionValues],
  )

  const armExit = useCallback(
    (mint: string, symbol: string) => {
      setTicketSide('sell')
      setPositionsOpen(true)
      selectMint(mint, symbol)
    },
    [selectMint],
  )

  const value = useMemo(
    () => ({
      hydrated,
      focusMint,
      focusSymbol,
      focusSignal,
      chartMode,
      slots,
      activeSlot,
      scan,
      scanning,
      scanError,
      ticketSide,
      ticketAmountSol,
      setTicketAmountSol,
      solPriceUsd,
      setSolPriceUsd,
      dataMode,
      setDataMode,
      coachCollapsed,
      discoverCollapsed,
      positionsOpen,
      discoverHighlight,
      watchlists,
      activeWatchlistId,
      setChartMode,
      setActiveSlot,
      setTicketSide,
      setCoachCollapsed,
      setDiscoverCollapsed,
      setPositionsOpen,
      setDiscoverHighlight,
      setActiveWatchlistId,
      selectMint,
      selectSignal,
      loadMintToSlot,
      toggleSlotLock,
      swapSlots,
      runScan,
      addToWatchlist,
      removeFromWatchlist,
      cycleWatchlist,
      createWatchlist,
      portfolioTotalUsd,
      positionValueUsd,
      setPortfolioSnapshot,
      armExit,
    }),
    [
      hydrated,
      focusMint,
      focusSymbol,
      focusSignal,
      chartMode,
      slots,
      activeSlot,
      scan,
      scanning,
      scanError,
      ticketSide,
      ticketAmountSol,
      solPriceUsd,
      dataMode,
      setDataMode,
      coachCollapsed,
      discoverCollapsed,
      positionsOpen,
      discoverHighlight,
      watchlists,
      activeWatchlistId,
      setChartMode,
      selectMint,
      selectSignal,
      loadMintToSlot,
      toggleSlotLock,
      swapSlots,
      runScan,
      addToWatchlist,
      removeFromWatchlist,
      cycleWatchlist,
      createWatchlist,
      portfolioTotalUsd,
      positionValueUsd,
      setPortfolioSnapshot,
      armExit,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
