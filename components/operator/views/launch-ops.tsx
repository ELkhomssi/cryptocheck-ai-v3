'use client'

import { useCallback, useEffect, useState } from 'react'

type Summary = {
  launchesToday: number
  migrationsToday: number
  feesClaimedToday: number | null
  paused: boolean
  sampleNote?: string
  ts?: string
}

/**
 * Operator Launch ops tile — live counts + pause indicator.
 * Fetches /api/launch/ops-summary using a pasteable ops bearer when needed.
 * Prefer deploying CRON_SECRET only server-side; this UI reads public status via
 * an authenticated same-origin helper cookie flow when available.
 */
export function LaunchOpsView() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!secret.trim()) {
      setError('Paste LAUNCH_CONTROL_SECRET / CRON_SECRET to load (not stored).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/launch/ops-summary', {
        headers: { authorization: `Bearer ${secret.trim()}` },
        cache: 'no-store',
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || res.statusText)
      setSummary(body as Summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSummary(null)
    } finally {
      setBusy(false)
    }
  }, [secret])

  const setPaused = useCallback(
    async (paused: boolean) => {
      if (!secret.trim()) return
      setBusy(true)
      try {
        const res = await fetch('/api/launch/control', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${secret.trim()}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ paused }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || res.statusText)
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [secret, load],
  )

  useEffect(() => {
    /* intentionally empty — operator pastes secret then loads */
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-100">Launch ops</h1>
        <p className="mt-1 text-sm text-zinc-400">
          New-create kill-switch · today&apos;s launches / migrations. Separate from Scan / Swap /
          Sniper.
        </p>
      </header>

      <label className="block text-xs uppercase tracking-wide text-zinc-500">
        Ops bearer (CRON_SECRET or LAUNCH_CONTROL_SECRET)
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100"
          autoComplete="off"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
        >
          Refresh
        </button>
        <button
          type="button"
          disabled={busy || !secret}
          onClick={() => void setPaused(true)}
          className="rounded bg-amber-500/90 px-3 py-1.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
        >
          Pause new launches
        </button>
        <button
          type="button"
          disabled={busy || !secret}
          onClick={() => void setPaused(false)}
          className="rounded bg-emerald-500/90 px-3 py-1.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
        >
          Resume launches
        </button>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Launches today" value={String(summary.launchesToday)} />
          <Tile label="Migrations today" value={String(summary.migrationsToday)} />
          <Tile
            label="Fees claimed today"
            value={
              summary.feesClaimedToday == null ? '—' : String(summary.feesClaimedToday)
            }
            hint={summary.sampleNote}
          />
          <Tile
            label="Kill-switch"
            value={summary.paused ? 'PAUSED' : 'LIVE'}
            tone={summary.paused ? 'warn' : 'ok'}
          />
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Load summary to see live tiles.</p>
      )}

      {summary?.ts ? (
        <p className="font-mono text-[10px] text-zinc-600">as of {summary.ts}</p>
      ) : null}
    </div>
  )
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'ok' | 'warn'
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          tone === 'warn' ? 'text-amber-300' : tone === 'ok' ? 'text-emerald-300' : 'text-zinc-100'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  )
}
