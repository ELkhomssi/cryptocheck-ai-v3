'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, BellOff, Loader2, RefreshCw } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { RevenueComplianceNote } from './RevenueComplianceNote'
import type { RevenueAlert, RevenueVerdict } from '@/lib/revenue-dashboard/types'

const SEVERITY_STYLES: Record<RevenueAlert['severity'], string> = {
  info: 'border-rd-mid/30 text-rd-mid',
  warning: 'border-rd-caution/40 text-rd-caution',
  critical: 'border-rd-danger/40 text-rd-danger',
}

const VERDICT_CHIP: Record<RevenueVerdict, string> = {
  SAFE: 'text-rd-safe',
  CAUTION: 'text-rd-caution',
  DANGER: 'text-rd-danger',
}

export function AlertsPanel() {
  const { walletAddress, isConnected } = useSolana()
  const [optIn, setOptIn] = useState(false)
  const [alerts, setAlerts] = useState<RevenueAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      if (!walletAddress) {
        setAlerts([])
        setOptIn(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const q = `wallet=${encodeURIComponent(walletAddress)}${refresh ? '&refresh=1' : ''}`
        const res = await fetch(`/api/revenue/alerts?${q}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Failed to load alerts')
        setOptIn(Boolean(json.optIn))
        setAlerts(Array.isArray(json.alerts) ? json.alerts : [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load alerts')
      } finally {
        setLoading(false)
      }
    },
    [walletAddress],
  )

  useEffect(() => {
    void load(optIn)
  }, [load, optIn])

  const toggleOptIn = async () => {
    if (!walletAddress) return
    setToggling(true)
    try {
      const res = await fetch('/api/revenue/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, optIn: !optIn }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Toggle failed')
      setOptIn(Boolean(json.optIn))
      setAlerts(Array.isArray(json.alerts) ? json.alerts : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toggle failed')
    } finally {
      setToggling(false)
    }
  }

  const markRead = async (id: string) => {
    if (!walletAddress) return
    await fetch('/api/revenue/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress, markReadId: id }),
    })
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)))
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-rd-green">
          Alerts
        </p>
        <h2 className="mt-1 font-rd-display text-xl font-bold uppercase tracking-[0.06em] text-rd-hi">
          Risk re-engagement
        </h2>
        <p className="mt-2 max-w-lg text-sm text-rd-mid">
          Get notified when a token you hold is flagged or its verdict worsens. Alerts are generated from real gateway
          scans only — never synthetic.
        </p>
      </header>

      <div className="rd-panel flex flex-wrap items-center justify-between gap-4 p-4">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-white/20"
            checked={optIn}
            disabled={!isConnected || toggling}
            onChange={() => void toggleOptIn()}
          />
          <span className="text-sm text-rd-hi">Alert me when a token I hold gets flagged</span>
        </label>
        <button
          type="button"
          disabled={!isConnected || !optIn || loading}
          onClick={() => void load(true)}
          className="inline-flex items-center gap-2 text-xs text-rd-violet hover:underline disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'motion-safe:animate-spin' : ''}`} />
          Check now
        </button>
      </div>

      {!isConnected ? (
        <div className="rd-panel p-6 text-sm text-rd-mid">Connect your wallet to manage alerts.</div>
      ) : loading && alerts.length === 0 ? (
        <div className="rd-panel flex items-center gap-2 p-6 text-sm text-rd-mid">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-rd-danger" role="alert">
          {error}
        </p>
      ) : !optIn ? (
        <div className="rd-panel flex items-center gap-3 p-6 text-sm text-rd-mid">
          <BellOff className="h-5 w-5 shrink-0 text-rd-lo" aria-hidden />
          Alerts are off. Enable the toggle above to track verdict changes on your holdings.
        </div>
      ) : alerts.length === 0 ? (
        <div className="rd-panel flex items-center gap-3 p-6 text-sm text-rd-mid">
          <Bell className="h-5 w-5 shrink-0 text-rd-lo" aria-hidden />
          No alerts yet. We will surface real verdict worsening when it happens on your next check.
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={`rd-panel p-4 ${a.read ? 'opacity-70' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span
                    className={`inline-flex rounded border px-1.5 py-0.5 font-rd-display text-[0.55rem] font-bold uppercase tracking-wider ${SEVERITY_STYLES[a.severity]}`}
                  >
                    {a.severity}
                  </span>
                  <p className="mt-2 text-sm text-rd-hi">{a.message}</p>
                  <p className="mt-1 font-rd-mono text-xs text-rd-lo">
                    <span className={VERDICT_CHIP[a.previousVerdict]}>{a.previousVerdict}</span>
                    {' → '}
                    <span className={VERDICT_CHIP[a.currentVerdict]}>{a.currentVerdict}</span>
                    {' · '}
                    {a.symbol}
                  </p>
                </div>
                <time className="shrink-0 font-rd-mono text-[0.65rem] text-rd-lo">
                  {new Date(a.createdAt).toLocaleString()}
                </time>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  href={a.terminalDeepLink}
                  className="font-rd-display text-[0.58rem] font-bold uppercase tracking-wider text-rd-violet hover:underline"
                >
                  Swap to safety →
                </Link>
                {!a.read ? (
                  <button
                    type="button"
                    onClick={() => void markRead(a.id)}
                    className="font-rd-display text-[0.58rem] font-bold uppercase tracking-wider text-rd-lo hover:text-rd-mid"
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <RevenueComplianceNote />
    </div>
  )
}
