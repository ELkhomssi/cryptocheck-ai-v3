'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { ScanResult } from '@/lib/revenue-dashboard/types'

export type ActionMode = 'scan' | 'swap' | 'sniper' | 'launch'

type ActionPanelState = {
  mode: ActionMode
  signal: UnifiedSignal | null
  mint: string
  scan: ScanResult | null
  scanning: boolean
  setMode: (m: ActionMode) => void
  selectSignal: (signal: UnifiedSignal, mode?: ActionMode) => void
  selectMint: (mint: string, mode?: ActionMode) => void
  runScan: (mint?: string) => Promise<void>
  clearScan: () => void
}

const Ctx = createContext<ActionPanelState | null>(null)

export function useActionPanel(): ActionPanelState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useActionPanel must be used within ActionPanelProvider')
  return v
}

export function ActionPanelProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ActionMode>('scan')
  const [signal, setSignal] = useState<UnifiedSignal | null>(null)
  const [mint, setMint] = useState('')
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)

  const runScan = useCallback(async (overrideMint?: string) => {
    const m = (overrideMint ?? mint).trim()
    if (m.length < 32) return
    setMint(m)
    setScanning(true)
    try {
      const res = await fetch('/api/revenue/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: m }),
      })
      const body = await res.json()
      if (res.ok) setScan(body as ScanResult)
    } catch (e) {
      console.error('[action-panel] scan failed', e)
    } finally {
      setScanning(false)
    }
  }, [mint])

  const selectSignal = useCallback(
    (s: UnifiedSignal, nextMode: ActionMode = 'scan') => {
      setSignal(s)
      const ca = s.contractAddress?.trim() ?? ''
      if (ca) setMint(ca)
      const mode =
        nextMode === 'launch' && !(process.env.NEXT_PUBLIC_LAUNCH_MODE_ENABLED === 'true')
          ? 'scan'
          : nextMode
      setMode(mode)
      if (ca && (mode === 'scan' || mode === 'swap')) void runScan(ca)
    },
    [runScan],
  )

  const selectMint = useCallback((m: string, nextMode: ActionMode = 'scan') => {
    setMint(m.trim())
    setSignal(null)
    const mode =
      nextMode === 'launch' && !(process.env.NEXT_PUBLIC_LAUNCH_MODE_ENABLED === 'true')
        ? 'scan'
        : nextMode
    setMode(mode)
  }, [])

  const clearScan = useCallback(() => setScan(null), [])

  const value = useMemo(
    () => ({
      mode,
      signal,
      mint,
      scan,
      scanning,
      setMode,
      selectSignal,
      selectMint,
      runScan,
      clearScan,
    }),
    [mode, signal, mint, scan, scanning, selectSignal, selectMint, runScan, clearScan],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
