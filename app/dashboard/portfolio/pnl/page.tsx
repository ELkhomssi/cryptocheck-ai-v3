'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSolana } from '@/components/SolanaProvider'
import { Wallet, TriangleAlert } from 'lucide-react'
import { RiskGatedSwapPanel } from '@/components/trading/RiskGatedSwapPanel'

type Position = {
  mint: string
  symbol: string
  amountTokens: number
  avgEntryPriceUsd: number
  currentPriceUsd: number
  valueUsd: number
  pnlUsd: number
  pnlPct: number
  riskScore: number
  riskDelta: number
  warnings: string[]
  estimated: boolean
}

type Portfolio = {
  walletAddress: string
  totalValueUsd: number
  totalPnlUsd: number
  totalPnlPct: number
  riskExposure: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  positions: Position[]
  lastUpdatedAt: string
}

const EXPOSURE_THEME: Record<Portfolio['riskExposure'], string> = {
  LOW: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  MEDIUM: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  HIGH: 'border-orange-500/45 bg-orange-500/10 text-orange-300',
  CRITICAL: 'border-rose-500/50 bg-rose-500/10 text-rose-300',
}

function riskColor(score: number): string {
  if (score >= 80) return 'text-rose-300'
  if (score >= 60) return 'text-orange-300'
  if (score >= 40) return 'text-amber-300'
  return 'text-emerald-300'
}

export default function PortfolioPnlPage() {
  const { walletAddress, isConnected, connect, shortAddr } = useSolana()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sellMint, setSellMint] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!walletAddress) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/portfolio/${walletAddress}`)
      if (res.status === 401) {
        setError('Sign in to your CryptoCheck account to view portfolio risk.')
        return
      }
      if (!res.ok) {
        setError('Could not load portfolio.')
        return
      }
      setPortfolio((await res.json()) as Portfolio)
    } catch {
      setError('Network error loading portfolio.')
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    void load()
  }, [load])

  if (!isConnected) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-bold text-white">Portfolio P&amp;L</h1>
        <p className="text-sm text-slate-400">Connect your wallet to see holdings, P&amp;L, and live risk exposure.</p>
        <button onClick={() => void connect()} className="inline-flex items-center gap-2 rounded-xl bg-[#00d4aa] px-5 py-3 text-sm font-semibold text-slate-950">
          <Wallet className="h-4 w-4" /> Connect wallet
        </button>
      </main>
    )
  }

  const riskAlerts = portfolio?.positions.filter((p) => p.riskDelta > 20) ?? []

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 text-slate-100">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio P&amp;L</h1>
          <p className="mt-1 font-mono text-xs text-slate-500">{shortAddr}</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-50">
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{error}</p> : null}

      {portfolio ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
              <p className="text-[0.6rem] uppercase tracking-wider text-slate-500">Total value</p>
              <p className="mt-1 text-xl font-bold text-white">${portfolio.totalValueUsd.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
              <p className="text-[0.6rem] uppercase tracking-wider text-slate-500">Total P&amp;L</p>
              <p className={`mt-1 text-xl font-bold ${portfolio.totalPnlUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {portfolio.totalPnlUsd >= 0 ? '+' : ''}${portfolio.totalPnlUsd.toFixed(2)} ({portfolio.totalPnlPct.toFixed(1)}%)
              </p>
            </div>
            <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${EXPOSURE_THEME[portfolio.riskExposure]}`}>
              <p className="text-[0.6rem] uppercase tracking-wider opacity-80">Risk exposure</p>
              <p className="text-lg font-bold">{portfolio.riskExposure}</p>
            </div>
          </section>

          {riskAlerts.length > 0 ? (
            <section className="space-y-2 rounded-2xl border border-orange-500/30 bg-orange-500/[0.06] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-orange-200">
                <TriangleAlert className="h-4 w-4" /> Risk alerts
              </p>
              {riskAlerts.map((p) => (
                <div key={p.mint} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-orange-100">⚠️ {p.symbol} risk increased {p.riskDelta} points since you entered.</span>
                  <button onClick={() => setSellMint(sellMint === p.mint ? null : p.mint)} className="rounded-lg bg-rose-500/20 px-3 py-1.5 font-semibold text-rose-200 hover:bg-rose-500/30">
                    {sellMint === p.mint ? 'Close' : 'SELL NOW'}
                  </button>
                </div>
              ))}
            </section>
          ) : null}

          {sellMint ? (
            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="mb-3 text-xs text-slate-400">Exit position via risk-gated swap (→ SOL):</p>
              <RiskGatedSwapPanel defaultToToken="So11111111111111111111111111111111111111112" defaultFromToken={sellMint} />
            </section>
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-200">Positions</p>
            {portfolio.positions.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">No positions above $1.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Token</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Entry</th>
                      <th className="py-2 pr-3">Current</th>
                      <th className="py-2 pr-3">P&amp;L</th>
                      <th className="py-2 pr-3">Risk</th>
                      <th className="py-2 pr-3">Warnings</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {portfolio.positions.map((p) => (
                      <tr key={p.mint} className="border-t border-white/[0.06]">
                        <td className="py-2 pr-3 font-semibold">{p.symbol}</td>
                        <td className="py-2 pr-3 tabular-nums">{p.amountTokens.toLocaleString()}</td>
                        <td className="py-2 pr-3">{p.estimated ? '—' : `$${p.avgEntryPriceUsd.toPrecision(4)}`}</td>
                        <td className="py-2 pr-3">${p.currentPriceUsd.toPrecision(4)}</td>
                        <td className={`py-2 pr-3 ${p.estimated ? 'text-slate-500' : p.pnlUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {p.estimated ? 'est.' : `${p.pnlUsd >= 0 ? '+' : ''}${p.pnlPct.toFixed(1)}%`}
                        </td>
                        <td className={`py-2 pr-3 font-bold ${riskColor(p.riskScore)}`}>{p.riskScore}</td>
                        <td className="py-2 pr-3 text-slate-500">{p.warnings.slice(0, 2).join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-center text-[0.6rem] text-slate-600">
            P&amp;L is estimated when entry price is unknown (not traded via CryptoCheck AI). Not financial advice.
          </p>
        </>
      ) : null}
    </main>
  )
}
