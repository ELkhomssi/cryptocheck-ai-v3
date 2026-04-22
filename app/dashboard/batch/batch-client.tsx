'use client'

import { useCallback, useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import { GlassCard } from '@/components/Dashboard/GlassCard'

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
    return <p className="text-sm text-slate-400">Loading plan limits…</p>
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <div className="flex items-center gap-2 text-slate-500">
          <Layers className="h-4 w-4" aria-hidden />
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em]">Batch</p>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-200">Multi-token scan</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
          Run <code className="text-emerald-200/90">POST /api/v1/scan/batch</code> with your signed-in session (Pro or
          Institutional). Daily quota applies to each token. Current tier batch cap:{' '}
          <span className="font-semibold text-slate-200">{maxBatch}</span> tokens.
        </p>
      </header>

      {error && (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      <GlassCard className="p-6">
        <label className="block text-xs font-medium text-slate-400">
          Token mints (one per line, comma, or space)
          <textarea
            value={rawMints}
            onChange={(e) => setRawMints(e.target.value)}
            rows={10}
            placeholder="So11111111111111111111111111111111111111112"
            className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-slate-100 outline-none ring-emerald-400/30 focus:ring-2"
          />
        </label>
        <label className="mt-4 block text-xs font-medium text-slate-400">
          Client reference (optional, ≤80 chars — desk, org desk ID, ticket)
          <input
            value={clientRef}
            onChange={(e) => setClientRef(e.target.value)}
            maxLength={80}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-400/30 focus:ring-2"
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={running}
            onClick={() => void runBatch()}
            className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? 'Scanning…' : 'Run batch'}
          </button>
          <p className="text-xs text-slate-500">
            Free-tier developers: use an API key with the same endpoint from the shell — browser session requires Pro
            or Institutional.
          </p>
        </div>
      </GlassCard>

      {result?.results && result.results.length > 0 && (
        <GlassCard className="overflow-hidden p-0">
          <div className="border-b border-white/10 px-5 py-3 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{result.succeeded ?? 0}</span> succeeded ·{' '}
            <span className="font-semibold text-slate-200">{result.failed ?? 0}</span> failed
            {result.request_id ? (
              <>
                {' '}
                · <span className="font-mono text-slate-500">{result.request_id}</span>
              </>
            ) : null}
            {result.client_ref ? (
              <>
                {' '}
                · ref <span className="font-mono text-slate-400">{result.client_ref}</span>
              </>
            ) : null}
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[rgba(10,10,11,0.95)] text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Mint</th>
                  <th className="px-4 py-2">Result</th>
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
                          score <span className="font-semibold text-emerald-200">{row.data.score ?? '—'}</span>
                          {row.data.decision ? (
                            <span className="ml-2 text-slate-400">{row.data.decision}</span>
                          ) : null}
                        </span>
                      )
                    } else {
                      resultCell = (
                        <span className="text-rose-200/90">
                          {row.error}
                          {row.code != null ? ` (${row.code})` : ''}
                        </span>
                      )
                    }
                    return (
                      <tr key={row.index} className="border-t border-white/[0.06]">
                        <td className="px-4 py-2 font-mono text-slate-500">{row.index}</td>
                        <td className="max-w-[200px] truncate px-4 py-2 font-mono text-xs text-slate-300">
                          {lastMints[row.index] ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-300">{resultCell}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
