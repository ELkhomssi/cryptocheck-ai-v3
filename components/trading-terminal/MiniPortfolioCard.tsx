'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSolana } from '@/components/SolanaProvider'
import { useTerminalFocus } from './TerminalFocusProvider'

type Position = {
  mint: string
  symbol: string
  valueUsd: number
  verdict: string
  riskScore: number
}

type PortfolioPayload = {
  totalValueUsd: number
  holdingCount: number
  positions: Position[]
}

export function MiniPortfolioCard() {
  const { walletAddress, isConnected, connect } = useSolana()
  const { setPortfolioSnapshot, selectMint } = useTerminalFocus()
  const [data, setData] = useState<PortfolioPayload | null>(null)

  const load = useCallback(async () => {
    if (!walletAddress) {
      setData(null)
      setPortfolioSnapshot(0, [])
      return
    }
    try {
      const res = await fetch(`/api/revenue/portfolio?wallet=${encodeURIComponent(walletAddress)}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setData(null)
        setPortfolioSnapshot(0, [])
        return
      }
      const body = (await res.json()) as {
        totalValueUsd: number
        holdingCount: number
        positions: Position[]
      }
      setData({
        totalValueUsd: body.totalValueUsd,
        holdingCount: body.holdingCount,
        positions: body.positions ?? [],
      })
      setPortfolioSnapshot(
        body.totalValueUsd,
        (body.positions ?? []).map((p) => ({ mint: p.mint, valueUsd: p.valueUsd })),
      )
    } catch {
      setData(null)
      setPortfolioSnapshot(0, [])
    }
  }, [walletAddress, setPortfolioSnapshot])

  useEffect(() => {
    void load()
    if (!walletAddress) return
    const t = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(t)
  }, [load, walletAddress])

  const slices = useMemo(() => {
    if (!data?.positions.length) return []
    const total = data.totalValueUsd || 1
    return data.positions
      .slice(0, 4)
      .map((p) => ({
        ...p,
        pct: (p.valueUsd / total) * 100,
      }))
  }, [data])

  return (
    <div className="shrink-0 border-t border-[var(--tit-border)] px-2.5 py-2">
      <p className="tit-label mb-1.5">Portfolio Overview</p>
      {!isConnected ? (
        <button type="button" onClick={() => void connect()} className="tit-btn-accent w-full py-1.5">
          Connect wallet
        </button>
      ) : !data ? (
        <p className="text-[0.65rem] text-[var(--tit-text-2)]">Loading…</p>
      ) : (
        <>
          <p className="tit-mono text-[0.85rem] font-bold text-[var(--tit-text-0)]">
            ${data.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="tit-mono mb-2 text-[0.55rem] text-[var(--tit-text-2)]">
            {data.holdingCount} holdings
          </p>
          {slices.length > 0 ? (
            <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-[var(--tit-bg-3)]">
              {slices.map((s, i) => (
                <div
                  key={s.mint}
                  style={{
                    width: `${Math.max(s.pct, 2)}%`,
                    background:
                      i === 0
                        ? 'var(--tit-accent)'
                        : i === 1
                          ? 'var(--tit-info)'
                          : i === 2
                            ? 'var(--tit-pos)'
                            : 'var(--tit-warn)',
                  }}
                />
              ))}
            </div>
          ) : null}
          <ul className="space-y-0.5">
            {slices.map((s) => (
              <li key={s.mint}>
                <button
                  type="button"
                  onClick={() => selectMint(s.mint, s.symbol)}
                  className="flex w-full items-center justify-between text-[0.6rem] text-[var(--tit-text-1)] hover:text-[var(--tit-text-0)]"
                >
                  <span className="truncate">{s.symbol}</span>
                  <span className="tit-mono">{s.pct.toFixed(0)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** Shared loader for bottom positions panel — reuses same portfolio endpoint. */
export function useTerminalPortfolio() {
  const { walletAddress, isConnected, connect } = useSolana()
  const { setPortfolioSnapshot, selectMint, armExit } = useTerminalFocus()
  const [data, setData] = useState<PortfolioPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!walletAddress) {
      setData(null)
      setPortfolioSnapshot(0, [])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/revenue/portfolio?wallet=${encodeURIComponent(walletAddress)}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setError('Portfolio unavailable')
        setData(null)
        setPortfolioSnapshot(0, [])
        return
      }
      const body = (await res.json()) as PortfolioPayload & { positions: Position[] }
      setData({
        totalValueUsd: body.totalValueUsd,
        holdingCount: body.holdingCount,
        positions: body.positions ?? [],
      })
      setPortfolioSnapshot(
        body.totalValueUsd,
        (body.positions ?? []).map((p) => ({ mint: p.mint, valueUsd: p.valueUsd })),
      )
    } catch {
      setError('Portfolio unavailable')
      setData(null)
      setPortfolioSnapshot(0, [])
    } finally {
      setLoading(false)
    }
  }, [walletAddress, setPortfolioSnapshot])

  useEffect(() => {
    void load()
    if (!walletAddress) return
    const t = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(t)
  }, [load, walletAddress])

  return { data, error, loading, isConnected, connect, selectMint, armExit, reload: load }
}
