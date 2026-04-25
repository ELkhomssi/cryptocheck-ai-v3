'use client'

import { type CSSProperties, useMemo, useState } from 'react'
import { GlassCard } from '@/components/Dashboard/GlassCard'
import { NeonForensicPanel } from '@/components/Dashboard/forensic-terminal/NeonForensicPanel'
import {
  terminalTokens,
  verdictAccent,
  type Verdict,
} from '@/components/Dashboard/intelligence-terminal/design/tokens'

type Tier = 'free' | 'micropack' | 'pro' | 'elite' | 'enterprise'

type TierLimits = {
  maxTokens: number
  scansPerDay: number
}

type Holding = {
  mint: string
  amount: number
  decimals: number
  symbol?: string
  name?: string
  valueUsd?: number
  riskScore: number
  verdict: 'SAFE' | 'CAUTION' | 'RISKY' | 'DANGER'
  signals: string[]
}

type SnapshotRow = {
  id: string
  scanned_at: string
  wallet_address: string
  total_tokens: number | null
  total_value_usd: number | null
  risky_tokens_count: number | null
}

type ScanResponse = {
  snapshotId: string | null
  holdings: Holding[]
  summary: {
    totalTokens: number
    totalValueUsd: number
    riskyTokensCount: number
    avgRiskScore: number
  }
  tier: Tier
  limits: TierLimits
  scansUsedToday?: number
}

const TIER_LABEL: Record<Tier, string> = {
  free: 'FREE',
  micropack: 'MICROPACK',
  pro: 'PRO',
  elite: 'ELITE',
  enterprise: 'ENTERPRISE',
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  )
}

function verdictStyle(verdict: Holding['verdict']): CSSProperties {
  const v = verdictAccent[verdict as Verdict]
  return {
    color: v.color,
    background: `${v.color}1f`,
    borderColor: `${v.color}55`,
  }
}

function parseError(err: unknown): string {
  if (!(err instanceof Error)) return 'Portfolio scan failed'
  return err.message || 'Portfolio scan failed'
}

type PortfolioScannerProps = {
  audience?: 'consumer' | 'dashboard'
  initialTier?: Tier
  initialHistory?: SnapshotRow[]
}

export default function PortfolioScanner({
  audience = 'consumer',
  initialTier = 'free',
  initialHistory = [],
}: PortfolioScannerProps) {
  const [walletAddress, setWalletAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scan, setScan] = useState<ScanResponse | null>(null)
  const [tier, setTier] = useState<Tier>(initialTier)
  const [history, setHistory] = useState<SnapshotRow[]>(initialHistory)
  const [scheduleWeekly, setScheduleWeekly] = useState(false)

  const scansUsed = scan?.scansUsedToday ?? 0
  const scansCap = scan?.limits.scansPerDay ?? 0

  const topRiskiest = useMemo(
    () => [...(scan?.holdings ?? [])].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5),
    [scan?.holdings]
  )
  const monoFont = { fontFamily: terminalTokens.fonts.data }
  const bodyFont = { fontFamily: terminalTokens.fonts.body }
  const isConsumer = audience === 'consumer'

  async function runScan() {
    if (!walletAddress.trim()) {
      setError('Enter a Solana wallet address.')
      return
    }
    setLoading(true)
    setError(null)
    setProgress('Scanning 0 tokens...')
    try {
      const res = await fetch('/api/v1/portfolio/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: walletAddress.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as ScanResponse & { error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Portfolio scan failed')
      }
      setProgress(`Scanning ${data.summary.totalTokens} of ${data.summary.totalTokens} tokens...`)
      setScan(data)
      setTier(data.tier)
      if (data.snapshotId) {
        setHistory((prev) => [
          {
            id: data.snapshotId,
            scanned_at: new Date().toISOString(),
            wallet_address: walletAddress.trim(),
            total_tokens: data.summary.totalTokens,
            total_value_usd: data.summary.totalValueUsd,
            risky_tokens_count: data.summary.riskyTokensCount,
          },
          ...prev,
        ].slice(0, 10))
      }
      setProgress(null)
    } catch (e) {
      setError(parseError(e))
      setProgress(null)
    } finally {
      setLoading(false)
    }
  }

  function exportCsv() {
    if (!scan?.holdings?.length) return
    const rows = [
      ['mint', 'symbol', 'name', 'amount', 'valueUsd', 'riskScore', 'verdict'],
      ...scan.holdings.map((h) => [h.mint, h.symbol ?? '', h.name ?? '', String(h.amount), String(h.valueUsd ?? 0), String(h.riskScore), h.verdict]),
    ]
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `portfolio-scan-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5" style={isConsumer ? monoFont : bodyFont}>
      <NeonForensicPanel
        title="Portfolio scan"
        subtitle="Wallet holdings · risk scoring · desk CSV export"
        tone={audience === 'consumer' ? 'capacity' : 'neutral'}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-space text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Active desk</p>
            <p className="mt-1 font-space text-lg font-bold text-slate-100">Scan wallet holdings for risk</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-md border px-2 py-1 text-[0.65rem] font-semibold tracking-wider"
              style={{
                borderColor: terminalTokens.colors.borderActive,
                background: terminalTokens.colors.primaryDim,
                color: terminalTokens.colors.primary,
              }}
            >
              {TIER_LABEL[tier]}
            </span>
            {scan && (
              <span className="text-[0.68rem] text-slate-400">
                {scansUsed} of {scansCap} scans used today
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Enter Solana wallet address"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 font-mono-terminal text-sm text-slate-100 outline-none transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/25"
          />
          <button
            type="button"
            className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 font-space text-xs font-bold uppercase tracking-[0.14em] text-slate-300"
          >
            Connect Wallet
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={runScan}
            className="rounded-xl border border-cyan-500/35 bg-gradient-to-r from-cyan-500/20 to-emerald-500/15 px-4 py-2.5 font-space text-xs font-bold uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
          >
            {loading ? 'Scanning...' : 'Scan Portfolio'}
          </button>
        </div>

        {progress && (
          <p className="mt-3 text-xs motion-safe:animate-pulse" style={{ color: terminalTokens.colors.textAccent }}>
            {progress}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}

        {scan && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <GlassCard className="p-4">
              <p className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Total Value</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">{formatUsd(scan.summary.totalValueUsd)}</p>
            </GlassCard>
            <GlassCard className="p-4">
              <p className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Risky Tokens</p>
              <p className="mt-2 text-xl font-semibold text-amber-200">{scan.summary.riskyTokensCount}</p>
            </GlassCard>
            <GlassCard className="p-4">
              <p className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Avg Risk Score</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">{scan.summary.avgRiskScore.toFixed(1)}</p>
            </GlassCard>
          </div>
        )}

        {scan && (
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {topRiskiest.map((h) => (
              <GlassCard key={h.mint} className="p-3">
                <p className="truncate text-xs font-semibold text-slate-200">{h.symbol || h.name || h.mint.slice(0, 8)}</p>
                <p className="mt-1 text-[0.65rem] text-slate-400">{h.mint.slice(0, 6)}...{h.mint.slice(-4)}</p>
                <p className="mt-2 text-lg font-semibold text-rose-200">{h.riskScore}</p>
                <span className="mt-2 inline-block rounded border px-2 py-0.5 text-[0.62rem]" style={verdictStyle(h.verdict)}>
                  {h.verdict}
                </span>
              </GlassCard>
            ))}
          </div>
        )}

        {scan && (
          <div className="mt-5 overflow-x-auto rounded-lg border border-white/10">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-slate-400">
                <tr>
                  <th className="px-3 py-2">Token</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2">Risk</th>
                  <th className="px-3 py-2">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {scan.holdings.map((h) => (
                  <tr key={h.mint} className="border-t border-white/5">
                    <td className="px-3 py-2 text-slate-200">{h.symbol || h.name || `${h.mint.slice(0, 8)}...`}</td>
                    <td className="px-3 py-2 text-slate-300">{h.amount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-slate-300">{formatUsd(h.valueUsd ?? 0)}</td>
                    <td className="px-3 py-2 text-slate-100">{h.riskScore}</td>
                    <td className="px-3 py-2">
                      <span className="rounded border px-2 py-0.5" style={verdictStyle(h.verdict)}>
                        {h.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {audience === 'dashboard' && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={tier === 'free' || tier === 'micropack' || !scan}
              className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-300 disabled:opacity-40"
            >
              Export as CSV (Pro+)
            </button>
            <label className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-[0.68rem] text-slate-300">
              <input
                type="checkbox"
                checked={scheduleWeekly}
                disabled={tier !== 'elite' && tier !== 'enterprise'}
                onChange={(e) => setScheduleWeekly(e.target.checked)}
              />
              Schedule weekly scans (Elite+)
            </label>
          </div>
        )}
      </NeonForensicPanel>

      {audience === 'dashboard' && (
        <NeonForensicPanel title="Snapshot history" subtitle="Last 10 desk scans" tone="capacity">
          <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-slate-400">
                <tr>
                  <th className="px-3 py-2">Scanned</th>
                  <th className="px-3 py-2">Wallet</th>
                  <th className="px-3 py-2">Tokens</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2">Risky</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={5}>
                      No snapshots yet.
                    </td>
                  </tr>
                ) : (
                  history.map((row) => (
                    <tr key={row.id} className="border-t border-white/5">
                      <td className="px-3 py-2 text-slate-300">{new Date(row.scanned_at).toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-300">{row.wallet_address.slice(0, 6)}...{row.wallet_address.slice(-4)}</td>
                      <td className="px-3 py-2 text-slate-300">{row.total_tokens ?? 0}</td>
                      <td className="px-3 py-2 text-slate-300">{formatUsd(Number(row.total_value_usd ?? 0))}</td>
                      <td className="px-3 py-2 text-slate-300">{row.risky_tokens_count ?? 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </NeonForensicPanel>
      )}
    </div>
  )
}
