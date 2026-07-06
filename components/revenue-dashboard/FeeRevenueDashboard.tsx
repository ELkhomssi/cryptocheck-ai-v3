'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, Lock, RefreshCw } from 'lucide-react'
import { RevenueComplianceNote } from './RevenueComplianceNote'
import type { RevenueMetrics } from '@/lib/revenue-dashboard/fee-analytics'

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function BarChart({ buckets, valueKey }: { buckets: RevenueMetrics['daily']; valueKey: 'feeUsd' | 'volumeUsd' }) {
  const max = Math.max(...buckets.map((b) => b[valueKey]), 0.0001)
  return (
    <div className="flex h-32 items-end gap-1" role="img" aria-label="Fees over time">
      {buckets.map((b) => {
        const v = b[valueKey]
        const h = max > 0 ? Math.max(2, (v / max) * 100) : 2
        return (
          <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-rd-green/70"
              style={{ height: `${h}%` }}
              title={`${b.label}: ${fmtUsd(v)}`}
            />
            <span className="truncate font-rd-mono text-[0.5rem] text-rd-lo">{b.label.slice(5)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function FeeRevenueDashboard() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setForbidden(false)
    try {
      const res = await fetch('/api/revenue/fees', { cache: 'no-store' })
      if (res.status === 401 || res.status === 403) {
        setForbidden(true)
        setMetrics(null)
        return
      }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load metrics')
      setMetrics(json as RevenueMetrics)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics')
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (forbidden) {
    return (
      <div className="space-y-4">
        <div className="rd-panel flex items-center gap-3 p-6 text-sm text-rd-mid">
          <Lock className="h-5 w-5 text-rd-caution" aria-hidden />
          <div>
            <p className="font-rd-display text-xs font-bold uppercase tracking-wider text-rd-hi">
              Owner access required
            </p>
            <p className="mt-1">
              Sign in with an admin account (DIAGNOSTICS_ADMIN_EMAILS / @cryptocheckai.com / ADMIN_WALLETS) to view
              realized fee revenue.
            </p>
          </div>
        </div>
        <RevenueComplianceNote />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-rd-green">
            Fee tracking
          </p>
          <h2 className="mt-1 font-rd-display text-xl font-bold uppercase tracking-[0.06em] text-rd-hi md:text-2xl">
            Revenue North Star
          </h2>
          <p className="mt-2 max-w-xl text-sm text-rd-mid">
            Realized swap fees from ledger + on-chain fee account. No estimates or fabricated volume.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-rd-sm border border-white/15 px-3 py-2 font-rd-display text-[0.6rem] font-bold uppercase tracking-wider text-rd-mid hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'motion-safe:animate-spin' : ''}`} />
            Refresh
          </button>
          <a
            href="/api/revenue/fees/export"
            className="inline-flex items-center gap-2 rounded-rd-sm border border-rd-green/40 bg-rd-green/10 px-3 py-2 font-rd-display text-[0.6rem] font-bold uppercase tracking-wider text-rd-green hover:bg-rd-green/20"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </div>
      </header>

      {loading && !metrics ? (
        <div className="rd-panel flex items-center gap-2 p-6 text-sm text-rd-mid">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          Loading realized fees…
        </div>
      ) : error ? (
        <p className="text-sm text-rd-danger" role="alert">
          {error}
        </p>
      ) : metrics ? (
        <>
          <article className="rd-panel border-rd-green/30 p-5">
            <p className="rd-label">Weekly fees (headline)</p>
            <p className="mt-2 font-rd-mono text-4xl font-semibold tabular-nums text-rd-green">
              {fmtUsd(metrics.ledger.weeklyFeesUsd)}
            </p>
            <p className="mt-1 text-sm text-rd-mid">{metrics.ledger.weeklyLabel}</p>
          </article>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total fees (ledger)', value: fmtUsd(metrics.ledger.totalFeesUsd) },
              { label: 'Volume routed', value: fmtUsd(metrics.ledger.totalVolumeUsd) },
              { label: 'Swaps', value: String(metrics.ledger.swapCount) },
              { label: 'Unique wallets', value: String(metrics.ledger.uniqueWallets) },
            ].map((c) => (
              <article key={c.label} className="rd-panel p-4">
                <p className="rd-label">{c.label}</p>
                <p className="mt-1 font-rd-mono text-2xl tabular-nums text-rd-hi">{c.value}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rd-panel p-4">
              <p className="rd-label mb-3">Daily fees (14d UTC)</p>
              {metrics.daily.every((d) => d.feeUsd === 0) ? (
                <p className="text-sm text-rd-mid">No fee activity in the last 14 days.</p>
              ) : (
                <BarChart buckets={metrics.daily} valueKey="feeUsd" />
              )}
            </article>
            <article className="rd-panel p-4">
              <p className="rd-label mb-3">Weekly fees (8w UTC)</p>
              {metrics.weekly.every((w) => w.feeUsd === 0) ? (
                <p className="text-sm text-rd-mid">No weekly fee buckets yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {metrics.weekly.map((w) => (
                    <li key={w.label} className="flex justify-between gap-2">
                      <span className="text-rd-mid">{w.label}</span>
                      <span className="font-rd-mono tabular-nums text-rd-hi">
                        {fmtUsd(w.feeUsd)} · {w.swapCount} swaps
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>

          <article className="rd-panel p-4">
            <p className="rd-label">{metrics.humanHeuristic.label}</p>
            <p className="mt-1 text-xs text-rd-lo">{metrics.humanHeuristic.note}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="font-rd-mono text-xl tabular-nums text-rd-safe">
                  {metrics.humanHeuristic.likelyHumanWallets}
                </p>
                <p className="text-xs text-rd-mid">Likely human</p>
              </div>
              <div>
                <p className="font-rd-mono text-xl tabular-nums text-rd-caution">
                  {metrics.humanHeuristic.likelyBotWallets}
                </p>
                <p className="text-xs text-rd-mid">Likely bot (heuristic)</p>
              </div>
              <div>
                <p className="font-rd-mono text-xl tabular-nums text-rd-lo">
                  {metrics.humanHeuristic.unknownWallets}
                </p>
                <p className="text-xs text-rd-mid">Unknown</p>
              </div>
            </div>
          </article>

          <article className="rd-panel p-4">
            <p className="rd-label">On-chain reconciliation</p>
            <p className="mt-2 text-sm text-rd-mid">{metrics.reconciliation.note}</p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-rd-lo">Ledger fees (USD)</dt>
                <dd className="font-rd-mono tabular-nums text-rd-hi">
                  {fmtUsd(metrics.reconciliation.ledgerFeesUsd)}
                </dd>
              </div>
              <div>
                <dt className="text-rd-lo">Fee account balance (UI)</dt>
                <dd className="font-rd-mono tabular-nums text-rd-hi">
                  {metrics.onChain.configured && metrics.onChain.balanceUi != null
                    ? metrics.onChain.balanceUi.toLocaleString()
                    : '—'}
                </dd>
              </div>
              {metrics.onChain.feeAccount ? (
                <div className="sm:col-span-2">
                  <dt className="text-rd-lo">Fee token account</dt>
                  <dd className="break-all font-rd-mono text-xs text-rd-mid">{metrics.onChain.feeAccount}</dd>
                </div>
              ) : null}
            </dl>
          </article>

          <article className="rd-panel overflow-x-auto p-4">
            <p className="rd-label mb-3">Recent swaps</p>
            {metrics.recent.length === 0 ? (
              <p className="text-sm text-rd-mid">No confirmed swaps with recorded fees yet.</p>
            ) : (
              <table className="w-full min-w-[720px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-left">
                    {['Time', 'Wallet', 'Volume', 'Fee', 'Tx'].map((h) => (
                      <th key={h} className="rd-label px-2 py-1.5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.recent.map((r) => (
                    <tr key={r.id} className="border-b border-white/[0.04]">
                      <td className="px-2 py-2 font-rd-mono text-rd-lo">
                        {new Date(r.executedAt).toLocaleString()}
                      </td>
                      <td className="px-2 py-2 font-rd-mono text-rd-mid">
                        {r.walletAddress.slice(0, 4)}…{r.walletAddress.slice(-4)}
                      </td>
                      <td className="px-2 py-2 font-rd-mono tabular-nums">{fmtUsd(r.volumeUsd)}</td>
                      <td className="px-2 py-2 font-rd-mono tabular-nums text-rd-green">
                        {r.feeAmountUsd != null ? fmtUsd(r.feeAmountUsd) : '—'}
                      </td>
                      <td className="px-2 py-2">
                        <a
                          href={`https://solscan.io/tx/${r.signature}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-rd-mono text-rd-violet underline"
                        >
                          {r.signature.slice(0, 8)}…
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          <p className="text-xs text-rd-lo">
            Generated {new Date(metrics.generatedAt).toLocaleString()} · Data source: Redis fee ledger + Solana RPC
          </p>
        </>
      ) : null}

      <RevenueComplianceNote />
    </div>
  )
}
