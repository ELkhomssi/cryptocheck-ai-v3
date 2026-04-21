'use client'

import { useEffect, useMemo, useState } from 'react'
import { GlassCard } from '@/components/Dashboard/GlassCard'
import {
  terminalTokens,
  verdictAccent,
  type Verdict,
} from '@/components/Dashboard/intelligence-terminal/design/tokens'

type WatchItem = {
  id: string
  mint: string
  symbol: string | null
  name: string | null
  last_risk_score: number | null
  last_verdict: string | null
}

type WatchlistResponse = {
  items: WatchItem[]
  tier: 'free' | 'micropack' | 'pro' | 'elite'
  usage: {
    used: number
    limit: number | null
  }
}

function verdictTone(verdict: string | null): string {
  if (!verdict) return terminalTokens.colors.textSecondary
  return verdictAccent[verdict as Verdict]?.color ?? terminalTokens.colors.textSecondary
}

type WatchlistPanelProps = {
  audience?: 'consumer' | 'dashboard'
}

export default function WatchlistPanel({ audience = 'consumer' }: WatchlistPanelProps) {
  const [mint, setMint] = useState('')
  const [symbol, setSymbol] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<WatchlistResponse | null>(null)

  const isConsumer = audience === 'consumer'

  async function refresh() {
    const res = await fetch('/api/v1/watchlist', { cache: 'no-store' })
    const json = (await res.json().catch(() => ({}))) as WatchlistResponse & { error?: string }
    if (!res.ok) throw new Error(json.error || 'Failed to load watchlist')
    setData(json)
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load watchlist'))
  }, [])

  const usageText = useMemo(() => {
    if (!data) return ''
    if (data.usage.limit == null) return `${data.usage.used} watched`
    return `${data.usage.used} of ${data.usage.limit} used`
  }, [data])

  async function addItem() {
    if (!mint.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: mint.trim(), symbol: symbol.trim() || undefined }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Failed to add token')
      setMint('')
      setSymbol('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add token')
    } finally {
      setLoading(false)
    }
  }

  async function removeItem(id: string) {
    setError(null)
    try {
      const res = await fetch(`/api/v1/watchlist/${id}`, { method: 'DELETE' })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Failed to remove token')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove token')
    }
  }

  return (
    <GlassCard className="p-5" >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className="text-[0.65rem] uppercase tracking-[0.2em]"
            style={{
              color: terminalTokens.colors.textMuted,
              fontFamily: isConsumer ? terminalTokens.fonts.data : terminalTokens.fonts.body,
            }}
          >
            Watchlist
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-100">Track risk changes for selected tokens</h3>
        </div>
        <div className="text-[0.68rem] text-slate-400">{usageText}</div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_160px_auto]">
        <input
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          placeholder="Token mint address"
          className="rounded-lg border bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none"
          style={{ borderColor: terminalTokens.colors.borderDefault }}
        />
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Symbol (optional)"
          className="rounded-lg border bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none"
          style={{ borderColor: terminalTokens.colors.borderDefault }}
        />
        <button
          type="button"
          disabled={loading}
          onClick={addItem}
          className="rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-50"
          style={{
            borderColor: terminalTokens.colors.borderActive,
            color: terminalTokens.colors.primary,
            background: terminalTokens.colors.primaryDim,
          }}
        >
          Add to watchlist
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p>}

      {data && data.usage.limit != null && data.usage.used >= data.usage.limit && (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {usageText} - upgrade for more watchlist capacity.
          <a href={audience === 'consumer' ? '/app' : '/dashboard/billing'} className="ml-2 underline">
            Upgrade
          </a>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {(data?.items ?? []).length === 0 ? (
          <p className="text-xs text-slate-500">No watched tokens yet.</p>
        ) : (
          data?.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-slate-100">{item.symbol || item.name || `${item.mint.slice(0, 8)}...`}</p>
                <p className="text-[0.68rem] text-slate-500">{item.mint}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[0.68rem] text-slate-500">Risk</p>
                  <p className="text-sm font-semibold" style={{ color: verdictTone(item.last_verdict) }}>
                    {item.last_risk_score ?? '--'} {item.last_verdict ? `(${item.last_verdict})` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded-md border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.12em] text-slate-300"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  )
}
