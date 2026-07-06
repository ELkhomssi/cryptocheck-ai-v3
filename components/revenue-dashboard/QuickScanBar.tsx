'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, Shield } from 'lucide-react'
import { terminalDeepLink } from '@/lib/revenue-dashboard/constants'
import type { RevenueVerdict, ScanResult } from '@/lib/revenue-dashboard/types'

const VERDICT_STYLES: Record<RevenueVerdict, string> = {
  SAFE: 'bg-rd-safe/15 text-rd-safe border-rd-safe/40',
  CAUTION: 'bg-rd-caution/15 text-rd-caution border-rd-caution/40',
  DANGER: 'bg-rd-danger/15 text-rd-danger border-rd-danger/40',
}

const ACTIVITY_KEY = 'ccai:rev:activity'

export type ActivityItem = {
  type: 'scan'
  mint: string
  verdict: RevenueVerdict
  at: string
} | {
  type: 'swap'
  mint: string
  signature: string
  at: string
}

export function pushScanActivity(item: { mint: string; verdict: RevenueVerdict; at: string }) {
  try {
    const raw = sessionStorage.getItem(ACTIVITY_KEY)
    const prev = raw ? (JSON.parse(raw) as ActivityItem[]) : []
    const next: ActivityItem[] = [{ type: 'scan' as const, ...item }, ...prev].slice(0, 20)
    sessionStorage.setItem(ACTIVITY_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function readScanActivity(): ActivityItem[] {
  try {
    const raw = sessionStorage.getItem(ACTIVITY_KEY)
    return raw ? (JSON.parse(raw) as ActivityItem[]) : []
  } catch {
    return []
  }
}

type Props = {
  onScanned?: (result: ScanResult) => void
}

export function QuickScanBar({ onScanned }: Props) {
  const [mint, setMint] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)

  const runScan = useCallback(async () => {
    const trimmed = mint.trim()
    if (trimmed.length < 32) {
      setError('Paste a valid Solana mint (32+ characters).')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/revenue/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')
      const scan = data as ScanResult
      setResult(scan)
      pushScanActivity({ mint: scan.mint, verdict: scan.verdict, at: scan.scannedAt })
      onScanned?.(scan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [mint, onScanned])

  return (
    <section className="rd-panel p-4 md:p-5" aria-label="Quick token scan">
      <p className="rd-label mb-3">Quick scan</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rd-lo"
            aria-hidden
          />
          <input
            type="text"
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runScan()}
            placeholder="Paste token mint address…"
            className="w-full rounded-rd-sm border border-white/10 bg-rd-navy/80 py-2.5 pl-10 pr-3 font-rd-mono text-sm text-rd-hi placeholder:text-rd-lo focus:border-rd-green/50 focus:outline-none focus:ring-1 focus:ring-rd-green/30"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={() => void runScan()}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-rd-sm bg-rd-green px-5 py-2.5 font-rd-display text-[0.65rem] font-bold uppercase tracking-[0.12em] text-rd-navy transition hover:brightness-110 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rd-green"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          Scan
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-sm text-rd-danger" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-4">
          <span
            className={`inline-flex items-center rounded-rd-sm border px-2.5 py-1 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider ${VERDICT_STYLES[result.verdict]}`}
          >
            {result.verdict}
          </span>
          <span className="font-rd-mono text-sm tabular-nums text-rd-hi">
            Score {result.safetyScore}/100
          </span>
          {result.sample ? <span className="rd-sample-tag">sample</span> : null}
          <Link
            href={terminalDeepLink(result.mint)}
            className="ml-auto inline-flex rounded-rd-sm border border-rd-violet/40 bg-rd-violet/15 px-4 py-2 font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.1em] text-rd-violet hover:bg-rd-violet/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rd-violet"
          >
            Trade safely →
          </Link>
        </div>
      ) : null}
    </section>
  )
}
