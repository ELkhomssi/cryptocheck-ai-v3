'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSolana } from '@/components/SolanaProvider'
import type { PortfolioStripData } from '@/lib/trading-terminal/types'
import { useTerminalFocus } from './TerminalFocusProvider'

type RevenuePortfolioResponse = {
  walletAddress: string
  totalValueUsd: number
  holdingCount: number
  flaggedCount: number
  exposure: string
  lastUpdatedAt: string
  positions: Array<{
    mint: string
    symbol: string
    valueUsd: number
    verdict: string
    riskScore: number
  }>
}

export function PortfolioStrip() {
  const { walletAddress, isConnected, connect } = useSolana()
  const { selectMint, positionsOpen, setPositionsOpen, setPortfolioSnapshot, armExit } =
    useTerminalFocus()
  const [data, setData] = useState<PortfolioStripData | null>(null)
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
      const body = (await res.json()) as RevenuePortfolioResponse
      const flagged = body.positions.filter(
        (p) => p.verdict === 'DANGER' || p.verdict === 'CAUTION',
      )
      setData({
        walletAddress: body.walletAddress,
        totalValueUsd: body.totalValueUsd,
        holdingCount: body.holdingCount,
        flaggedCount: body.flaggedCount,
        exposure: body.exposure,
        topAlert: flagged[0] ? `${flagged[0].symbol} ${flagged[0].verdict}` : null,
        lastUpdatedAt: body.lastUpdatedAt,
        positions: body.positions.map((p) => ({
          mint: p.mint,
          symbol: p.symbol,
          valueUsd: p.valueUsd,
          verdict: p.verdict,
          riskScore: p.riskScore,
        })),
      })
      setPortfolioSnapshot(
        body.totalValueUsd,
        body.positions.map((p) => ({ mint: p.mint, valueUsd: p.valueUsd })),
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

  return (
    <div className="tit-panel shrink-0">
      <div className="flex h-10 items-center gap-3 overflow-x-auto px-3 text-xs">
        {!isConnected ? (
          <button type="button" onClick={() => void connect()} className="tit-btn-ember px-3 py-1">
            Connect wallet
          </button>
        ) : loading && !data ? (
          <span className="text-[var(--tit-text-2)]">Loading portfolio…</span>
        ) : error ? (
          <span className="text-[var(--tit-neg)]">{error}</span>
        ) : data ? (
          <>
            <span className="tit-mono font-semibold text-[var(--tit-text-0)]">
              Σ ${data.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="tit-mono text-[var(--tit-text-1)]">
              Positions {data.holdingCount}
            </span>
            <span className="tit-mono text-[var(--tit-text-1)]">Exposure {data.exposure}</span>
            {data.flaggedCount > 0 ? (
              <span className="tit-mono text-[var(--tit-warn)]">Flagged {data.flaggedCount}</span>
            ) : null}
            {data.topAlert ? (
              <span className="tit-mono truncate text-[var(--tit-warn)]">Alert: {data.topAlert}</span>
            ) : null}
          </>
        ) : (
          <span className="text-[var(--tit-text-2)]">No holdings</span>
        )}

        <button
          type="button"
          onClick={() => setPositionsOpen(!positionsOpen)}
          className="ml-auto shrink-0 rounded border border-white/10 px-2 py-0.5 text-[0.65rem] text-[var(--tit-text-1)] hover:text-[var(--tit-text-0)]"
        >
          Positions (P)
        </button>
      </div>

      {positionsOpen && data && data.positions.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto border-t border-white/[0.06]">
          {data.positions.map((p) => {
            const pct =
              data.totalValueUsd > 0 ? ((p.valueUsd / data.totalValueUsd) * 100).toFixed(0) : '—'
            return (
              <li
                key={p.mint}
                className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--tit-bg-2)]"
              >
                <button
                  type="button"
                  onClick={() => selectMint(p.mint, p.symbol)}
                  className="min-w-0 flex-1 truncate text-left"
                >
                  <span className="font-medium">{p.symbol}</span>
                  <span className="tit-mono ml-2 text-[var(--tit-text-2)]">
                    ${p.valueUsd.toFixed(2)} · {pct}%
                  </span>
                </button>
                <span className="tit-mono uppercase text-[var(--tit-text-2)]">{p.verdict}</span>
                <button
                  type="button"
                  onClick={() => armExit(p.mint, p.symbol)}
                  className="rounded border border-[var(--tit-neg)]/40 px-1.5 py-0.5 text-[0.6rem] font-semibold text-[var(--tit-neg)]"
                  title="Arm sell ticket"
                >
                  Exit
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
