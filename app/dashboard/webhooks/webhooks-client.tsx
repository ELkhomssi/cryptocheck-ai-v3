'use client'

import { useCallback, useEffect, useState } from 'react'
import { Webhook } from 'lucide-react'
import { GlassCard } from '@/components/Dashboard/GlassCard'

type WebhookRow = {
  id: string
  url: string
  events: string[]
  is_active: boolean
  consecutive_failures: number
  last_success_at: string | null
  created_at: string
}

const EVENT_OPTIONS = [
  { id: 'scan.completed', label: 'Scan completed' },
  { id: 'risk.changed', label: 'Watchlist risk change' },
  { id: 'whale.moved', label: 'Whale moved (reserved)' },
  { id: 'high_safety_token', label: 'High safety token (legacy)' },
  { id: 'risk_status_change', label: 'Risk status change (legacy)' },
] as const

export default function WebhooksClient() {
  const [loading, setLoading] = useState(true)
  const [tierOk, setTierOk] = useState<boolean | null>(null)
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [newUrl, setNewUrl] = useState('')
  const [newEvents, setNewEvents] = useState<string[]>(['scan.completed', 'risk.changed'])
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refreshWebhooks = useCallback(async () => {
    const res = await fetch('/api/dashboard/webhooks', { cache: 'no-store' })
    const j = (await res.json().catch(() => ({}))) as { webhooks?: WebhookRow[]; error?: string }
    if (!res.ok) throw new Error(j.error || 'Failed to load webhooks')
    setWebhooks(j.webhooks ?? [])
  }, [])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const me = await fetch('/api/dashboard/me', { cache: 'no-store' })
        const mj = (await me.json().catch(() => ({}))) as {
          subscription?: { effectiveTier?: string }
          error?: string
        }
        if (!me.ok) throw new Error(mj.error || 'Could not load subscription')
        const isEnt = mj.subscription?.effectiveTier === 'ENTERPRISE'
        setTierOk(isEnt)
        if (!isEnt) {
          setWebhooks([])
          return
        }
        await refreshWebhooks()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })()
  }, [refreshWebhooks])

  async function createWebhook() {
    setError(null)
    setRevealedSecret(null)
    const res = await fetch('/api/dashboard/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: newUrl, events: newEvents }),
    })
    const j = (await res.json().catch(() => ({}))) as { secret?: string; error?: string }
    if (!res.ok) {
      setError(j.error || 'Create failed')
      return
    }
    if (typeof j.secret === 'string') setRevealedSecret(j.secret)
    setNewUrl('')
    await refreshWebhooks()
  }

  async function toggleActive(row: WebhookRow) {
    setBusyId(row.id)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/webhooks/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !row.is_active }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(j.error || 'Update failed')
      await refreshWebhooks()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function testWebhook(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId: id }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean }
      if (!res.ok) throw new Error(j.error || 'Test delivery failed')
      await refreshWebhooks()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteId) return
    setBusyId(deleteId)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/webhooks/${deleteId}`, { method: 'DELETE' })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(j.error || 'Delete failed')
      setDeleteId(null)
      await refreshWebhooks()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  function toggleNewEvent(id: string) {
    setNewEvents((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <p className="text-sm text-slate-400">Loading webhooks…</p>
      </div>
    )
  }

  if (tierOk === null && error) {
    return (
      <div className="space-y-8">
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      </div>
    )
  }

  if (tierOk === false) {
    return (
      <div className="space-y-8">
        <header className="max-w-3xl">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Webhooks</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-200">Enterprise webhooks</h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
            Outbound HTTPS webhooks are available on the Enterprise plan. Upgrade to connect your own SIEM, Slack
            bridge, or internal risk ledger.
          </p>
        </header>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <div className="flex items-center gap-2 text-slate-500">
          <Webhook className="h-4 w-4" aria-hidden />
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em]">Webhooks</p>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-200">Enterprise endpoints</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
          CryptoCheck posts signed JSON to your HTTPS URL for scan completion and watchlist risk shifts. Retries use
          exponential backoff; endpoints are paused after ten consecutive failed delivery campaigns.
        </p>
      </header>

      {error && (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      {revealedSecret && (
        <GlassCard className="border border-amber-400/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/90">Signing secret (copy now)</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-200">{revealedSecret}</p>
          <p className="mt-2 text-xs text-slate-500">This value is not shown again after you leave the page.</p>
        </GlassCard>
      )}

      <GlassCard className="p-6">
        <h2 className="text-sm font-semibold text-slate-200">Register endpoint</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-xs text-slate-400">
            <span className="mb-1 block font-medium text-slate-300">HTTPS URL</span>
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com/hooks/cryptocheck"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-400/30 focus:ring-2"
            />
          </label>
          <button
            type="button"
            onClick={() => void createWebhook()}
            disabled={!newUrl.trim()}
            className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create
          </button>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-400">Events</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EVENT_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={newEvents.includes(opt.id)}
                  onChange={() => toggleNewEvent(opt.id)}
                  className="accent-emerald-400"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </GlassCard>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Your endpoints</h2>
        {webhooks.length === 0 ? (
          <p className="text-sm text-slate-500">No webhooks yet.</p>
        ) : (
          webhooks.map((w) => (
            <GlassCard key={w.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="break-all font-mono text-sm text-emerald-100/90">{w.url}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(w.events ?? []).join(', ')} · failures {w.consecutive_failures}
                    {w.last_success_at ? ` · last OK ${new Date(w.last_success_at).toLocaleString()}` : ''}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${
                      w.is_active
                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                        : 'border-rose-400/30 bg-rose-500/10 text-rose-200'
                    }`}
                  >
                    {w.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === w.id}
                    onClick={() => void testWebhook(w.id)}
                    className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-40"
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    disabled={busyId === w.id}
                    onClick={() => void toggleActive(w)}
                    className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-40"
                  >
                    {w.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === w.id}
                    onClick={() => setDeleteId(w.id)}
                    className="rounded-md border border-rose-400/30 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <GlassCard className="max-w-md p-6">
            <p className="text-sm font-semibold text-slate-100">Delete webhook?</p>
            <p className="mt-2 text-xs text-slate-400">This cannot be undone. In-flight retries for this endpoint stop.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="rounded-md bg-rose-500/90 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
