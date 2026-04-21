'use client'

import { useEffect, useState } from 'react'
import { GlassCard } from '@/components/Dashboard/GlassCard'

type Prefs = {
  telegram_chat_id: string | null
  telegram_linked_at: string | null
  telegram_alerts_enabled: boolean
  email_alerts_enabled: boolean
  min_risk_change: number
}

export default function DashboardAlertsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [linked, setLinked] = useState(false)
  const [prefs, setPrefs] = useState<Prefs | null>(null)

  async function loadState() {
    const res = await fetch('/api/v1/alerts/telegram-link', { cache: 'no-store' })
    const j = (await res.json().catch(() => ({}))) as { linked?: boolean; preferences?: Prefs; error?: string }
    if (!res.ok) throw new Error(j.error || 'Failed to load alerts settings')
    setLinked(Boolean(j.linked))
    setPrefs(j.preferences ?? null)
  }

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        await loadState()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load alerts settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function generateLinkCode() {
    setError(null)
    const res = await fetch('/api/v1/alerts/telegram-link', { method: 'POST' })
    const j = (await res.json().catch(() => ({}))) as { code?: string; expiresAt?: string; error?: string }
    if (!res.ok) {
      setError(j.error || 'Could not generate link code')
      return
    }
    setCode(j.code ?? null)
    setExpiresAt(j.expiresAt ?? null)
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Alerts</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-200">Telegram alert linking</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
          Connect Telegram to receive watchlist risk alerts directly from CryptoCheck AI.
        </p>
      </header>

      <GlassCard className="p-6">
        {loading ? (
          <p className="text-sm text-slate-400">Loading alert preferences...</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md border px-2 py-1 text-[0.65rem] font-semibold tracking-wider ${
                  linked
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                }`}
              >
                {linked ? 'Telegram connected' : 'Telegram not connected'}
              </span>
              {prefs?.telegram_linked_at && (
                <span className="text-[0.68rem] text-slate-500">
                  Linked: {new Date(prefs.telegram_linked_at).toLocaleString()}
                </span>
              )}
            </div>

            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-300">
              <li>Click "Connect Telegram for alerts".</li>
              <li>Open <strong>@CryptoCheck_AI</strong> in Telegram.</li>
              <li>Send: <code>/link cc_link_...</code></li>
              <li>Bot verifies your code and links your chat.</li>
            </ol>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={generateLinkCode}
                className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200"
              >
                Connect Telegram for alerts
              </button>
              <button
                type="button"
                onClick={() => void loadState()}
                className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300"
              >
                Refresh status
              </button>
            </div>

            {code && (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
                <p className="text-[0.68rem] text-slate-400">Use this command in Telegram:</p>
                <p className="mt-1 font-mono text-sm text-cyan-200">/link {code}</p>
                {expiresAt && (
                  <p className="mt-1 text-[0.68rem] text-slate-500">
                    Expires: {new Date(expiresAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}
          </>
        )}
      </GlassCard>
    </div>
  )
}
