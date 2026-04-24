'use client'

import { useCallback, useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import { NeonForensicPanel } from '@/components/Dashboard/forensic-terminal/NeonForensicPanel'

function maxBatchForRuntimeTier(rt: string | undefined): number {
  if (rt === 'institutional') return 100
  if (rt === 'pro') return 20
  return 5
}

type BatchRowOk = { index: number; ok: true; data: { score?: number; decision?: string } }
type BatchRowErr = { index: number; ok: false; error: string; code?: number }
type BatchRow = BatchRowOk | BatchRowErr

type BatchResponse = {
  request_id?: string
  batch_size?: number
  succeeded?: number
  failed?: number
  client_ref?: string
  results?: BatchRow[]
  error?: string
  code?: number
  reason?: string
}

function parseMints(raw: string): string[] {
  const lines = raw
    .split(/[\n,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of lines) {
    if (seen.has(m)) continue
    seen.add(m)
    out.push(m)
  }
  return out
}

export default function BatchClient() {
  const [runtimeTier, setRuntimeTier] = useState<string | undefined>()
  const [tierLoading, setTierLoading] = useState(true)
  const [rawMints, setRawMints] = useState('')
  const [clientRef, setClientRef] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BatchResponse | null>(null)
  const [lastMints, setLastMints] = useState<string[]>([])

  const maxBatch = maxBatchForRuntimeTier(runtimeTier)

  const loadMe = useCallback(async () => {
    const res = await fetch('/api/dashboard/me', { cache: 'no-store' })
    const j = (await res.json().catch(() => ({}))) as { subscription?: { runtimeTier?: string } }
    if (res.ok) setRuntimeTier(j.subscription?.runtimeTier)
    setTierLoading(false)
  }, [])

  useEffect(() => {
    void loadMe()
  }, [loadMe])

  async function runBatch() {
    setError(null)
    setResult(null)
    const mints = parseMints(rawMints).filter((m) => m.length >= 32 && m.length <= 44)
    if (mints.length === 0) {
      setError('Add at least one valid Solana mint (32–44 characters).')
      return
    }
    if (mints.length > maxBatch) {
      setError(`This plan allows up to ${maxBatch} tokens per batch. Trim the list or upgrade.`)
      return
    }

    setRunning(true)
    setLastMints(mints)
    try {
      const res = await fetch('/api/v1/scan/batch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: 'solana',
          items: mints.map((tokenAddress) => ({ tokenAddress, chain: 'solana' })),
          ...(clientRef.trim() ? { clientRef: clientRef.trim().slice(0, 80) } : {}),
        }),
      })
      const j = (await res.json().catch(() => ({}))) as BatchResponse
      if (!res.ok) {
        setError(j.error || `Request failed (${res.status})`)
        return
      }
      setResult(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setRunning(false)
    }
  }

  if (tierLoading) {
    return (
      <p className="font-mono-terminal text-base text-slate-400 motion-safe:animate-pulse">Loading plan limits…</p>
    )
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <div className="flex items-center gap-2 font-space text-xs font-bold uppercase tracking-[0.22em] text-cyan-400/80">
          <Layers className="h-4 w-4" aria-hidden />
          <p>Batch</p>
        </div>
        <h1 className="mt-2 font-space text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">Multi-token scan</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-400">
          Run{' '}
          <code className="font-mono-terminal text-sm text-emerald-200/90">POST /api/v1/scan/batch</code> with your
          signed-in session (Pro or Institutional). Daily quota applies to each token. Current tier batch cap:{' '}
          <span className="font-mono-terminal font-bold text-cyan-200">{maxBatch}</span> tokens.
        </p>
      </header>

      {error && (
        <p className="font-mono-terminal text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      <NeonForensicPanel
        title="Batch configuration"
        subtitle="Paste mints · optional client reference for audit logs"
        tone="capacity"
      >
        <label className="block font-space text-xs font-bold uppercase tracking-wider text-slate-500">
          Token mints (one per line, comma, or space)
          <textarea
            value={rawMints}
            onChange={(e) => setRawMints(e.target.value)}
            rows={10}
            placeholder="So11111111111111111111111111111111111111112"
            className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-3 font-mono-terminal text-sm text-slate-100 outline-none ring-emerald-400/30 focus:ring-2"
          />
        </label>
        <label className="mt-4 block font-space text-xs font-bold uppercase tracking-wider text-slate-500">
          Client reference (optional, ≤80 chars — desk, org desk ID, ticket)
          <input
            value={clientRef}
            onChange={(e) => setClientRef(e.target.value)}
            maxLength={80}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 font-mono-terminal text-sm text-slate-100 outline-none ring-emerald-400/30 focus:ring-2"
          />
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={running}
            onClick={() => void runBatch()}
            className="rounded-xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/25 to-cyan-500/20 px-5 py-2.5 font-space text-sm font-bold uppercase tracking-widest text-emerald-100 transition hover:from-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? 'Scanning…' : 'Run batch'}
          </button>
          <p className="max-w-md text-sm text-slate-500">
            Free-tier developers: use an API key with the same endpoint from the shell — browser session requires Pro
            or Institutional.
          </p>
        </div>
      </NeonForensicPanel>

      {result?.results && result.results.length > 0 && (
        <NeonForensicPanel
          title="Batch results"
          badge={`${result.succeeded ?? 0} ok · ${result.failed ?? 0} fail`}
          tone="neutral"
          contentClassName="!p-0 sm:!p-0"
        >
          <div className="border-b border-white/10 px-5 py-3 font-mono-terminal text-xs text-slate-400">
            <span className="font-bold text-slate-200">{result.succeeded ?? 0}</span> succeeded ·{' '}
            <span className="font-bold text-slate-200">{result.failed ?? 0}</span> failed
            {result.request_id ? (
              <>
                {' '}
                · <span className="text-slate-500">{result.request_id}</span>
              </>
            ) : null}
            {result.client_ref ? (
              <>
                {' '}
                · ref <span className="text-slate-400">{result.client_ref}</span>
              </>
            ) : null}
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[#020617]/95 text-xs uppercase tracking-wider text-slate-500 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-2 font-space">#</th>
                  <th className="px-4 py-2 font-space">Mint</th>
                  <th className="px-4 py-2 font-space">Result</th>
                </tr>
              </thead>
              <tbody>
                {[...result.results]
                  .sort((a, b) => a.index - b.index)
                  .map((row) => {
                    let resultCell: React.ReactNode
                    if (row.ok === true) {
                      resultCell = (
                        <span>
                          score{' '}
                          <span className="font-mono-terminal font-bold text-emerald-200">{row.data.score ?? '—'}</span>
                          {row.data.decision ? (
                            <span className="ml-2 text-slate-400">{row.data.decision}</span>
                          ) : null}
                        </span>
                      )
                    } else {
                      resultCell = (
                        <span className="font-mono-terminal text-rose-200/90">
                          {row.error}
                          {row.code != null ? ` (${row.code})` : ''}
                        </span>
                      )
                    }
                    return (
                      <tr key={row.index} className="border-t border-white/[0.06]">
                        <td className="px-4 py-2 font-mono-terminal text-slate-500">{row.index}</td>
                        <td className="max-w-[200px] truncate px-4 py-2 font-mono-terminal text-xs text-slate-300">
                          {lastMints[row.index] ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-300">{resultCell}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </NeonForensicPanel>
      )}
    </div>
  )
}
