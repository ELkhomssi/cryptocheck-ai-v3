'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { RevenueComplianceNote } from './RevenueComplianceNote'
import {
  isFlaggedVerdict,
  swapToSafetyHref,
  type RevenuePortfolioSummary,
} from '@/lib/revenue-dashboard/portfolio-mapper'
import type { PortfolioPosition, RevenueVerdict } from '@/lib/revenue-dashboard/types'

const VERDICT_STYLES: Record<RevenueVerdict, string> = {
  SAFE: 'text-rd-safe border-rd-safe/35',
  CAUTION: 'text-rd-caution border-rd-caution/35',
  DANGER: 'text-rd-danger border-rd-danger/35',
}

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function PortfolioScanner() {
  const { walletAddress, isConnected } = useSolana()
  const [data, setData] = useState<RevenuePortfolioSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!walletAddress) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/revenue/portfolio?wallet=${encodeURIComponent(walletAddress)}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Portfolio scan failed')
      setData(json as RevenuePortfolioSummary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Portfolio scan failed')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [walletAddress])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-rd-green">
            Portfolio scanner
          </p>
          <h2 className="mt-1 font-rd-display text-xl font-bold uppercase tracking-[0.06em] text-rd-hi">
            Holdings risk
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={!isConnected || loading}
          className="inline-flex items-center gap-2 rounded-rd-sm border border-white/15 px-3 py-2 font-rd-display text-[0.6rem] font-bold uppercase tracking-wider text-rd-mid hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'motion-safe:animate-spin' : ''}`} />
          Rescan
        </button>
      </header>

      {!isConnected ? (
        <div className="rd-panel p-6 text-sm text-rd-mid">Connect your wallet to scan holdings.</div>
      ) : loading && !data ? (
        <div className="rd-panel flex items-center gap-2 p-6 text-sm text-rd-mid">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          Scanning holdings via gateway…
        </div>
      ) : error ? (
        <p className="text-sm text-rd-danger" role="alert">
          {error}
        </p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <article className="rd-panel p-4">
              <p className="rd-label">Total value</p>
              <p className="mt-1 font-rd-mono text-2xl tabular-nums text-rd-hi">{fmtUsd(data.totalValueUsd)}</p>
            </article>
            <article className="rd-panel p-4">
              <p className="rd-label">Flagged tokens</p>
              <p className="mt-1 font-rd-mono text-2xl tabular-nums text-rd-caution">{data.flaggedCount}</p>
              <p className="text-xs text-rd-lo">of {data.holdingCount} holdings</p>
            </article>
            <article className="rd-panel p-4">
              <p className="rd-label">Exposure in flagged</p>
              <p className="mt-1 font-rd-mono text-2xl tabular-nums text-rd-hi">{data.flaggedPct.toFixed(1)}%</p>
              <p className="text-xs text-rd-lo">{fmtUsd(data.flaggedValueUsd)}</p>
            </article>
          </div>

          {data.positions.length === 0 ? (
            <div className="rd-panel p-6 text-sm text-rd-mid">
              No tradable token holdings found (minimum ~$1 value).
            </div>
          ) : (
            <div className="rd-panel overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-left">
                    {['Token', 'Balance', 'Value', 'Score', 'Verdict', 'Share', ''].map((h) => (
                      <th key={h || 'action'} className="rd-label px-3 py-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.positions.map((p) => (
                    <PositionRow key={p.mint} position={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-rd-lo">
            Exposure: {data.exposure} · Updated {new Date(data.lastUpdatedAt).toLocaleString()}
          </p>
        </>
      ) : null}

      <RevenueComplianceNote />
    </div>
  )
}

function PositionRow({ position: p }: { position: PortfolioPosition }) {
  const flagged = isFlaggedVerdict(p.verdict)

  return (
    <tr className="border-b border-white/[0.05] hover:bg-white/[0.02]">
      <td className="px-3 py-2.5">
        <div className="font-rd-mono text-xs text-rd-hi">{p.symbol}</div>
        <div className="font-rd-mono text-[0.65rem] text-rd-lo">
          {p.mint.slice(0, 4)}…{p.mint.slice(-4)}
        </div>
      </td>
      <td className="px-3 py-2.5 font-rd-mono tabular-nums text-rd-mid">
        {p.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
      </td>
      <td className="px-3 py-2.5 font-rd-mono tabular-nums text-rd-hi">{fmtUsd(p.valueUsd)}</td>
      <td className="px-3 py-2.5 font-rd-mono tabular-nums text-rd-hi">{p.safetyScore}</td>
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex rounded border px-1.5 py-0.5 font-rd-display text-[0.58rem] font-bold uppercase tracking-wider ${VERDICT_STYLES[p.verdict]}`}
        >
          {p.verdict}
        </span>
      </td>
      <td className="px-3 py-2.5 font-rd-mono tabular-nums text-rd-lo">{p.concentrationPct.toFixed(1)}%</td>
      <td className="px-3 py-2.5 text-right">
        {flagged ? (
          <Link
            href={swapToSafetyHref(p.mint, p.balance)}
            className="inline-flex items-center gap-1 rounded-rd-sm border border-rd-violet/40 bg-rd-violet/10 px-2.5 py-1.5 font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-rd-violet hover:bg-rd-violet/20"
          >
            <ShieldAlert className="h-3 w-3" aria-hidden />
            Swap to safety
          </Link>
        ) : (
          <span className="text-xs text-rd-lo">—</span>
        )}
      </td>
    </tr>
  )
}
