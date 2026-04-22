'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/Dashboard/GlassCard'
import { copyToClipboard } from '@/lib/utils'

type Sec = {
  trust_score: number
  trust_note: string
  alerts: Array<{ action: string; created_at: string; metadata?: Record<string, unknown> }>
  recent_events: Array<{ action: string; created_at: string }>
  preview?: boolean
}

type KeyRow = {
  schema: 'v1' | 'v2'
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  status: 'active' | 'revoked'
}

function isFreeTier(tier: string): boolean {
  return tier.trim().toUpperCase() === 'FREE'
}

function severity(action: string): 'critical' | 'warn' | 'info' {
  if (action.includes('denied') || action.includes('error') || action.includes('revoked')) return 'critical'
  if (action.includes('warn') || action.includes('limit')) return 'warn'
  return 'info'
}

function rowClass(s: ReturnType<typeof severity>) {
  if (s === 'critical') return 'border-l-rose-400/50 bg-rose-500/[0.05]'
  if (s === 'warn') return 'border-l-amber-400/45 bg-amber-500/[0.04]'
  return 'border-l-emerald-400/30 bg-emerald-500/[0.03]'
}

const FREE_PLACEHOLDER_KEYS: KeyRow[] = [
  {
    schema: 'v1',
    id: 'preview-v1',
    name: 'Production (masked)',
    key_prefix: 'cc_live_••••••••••••8f2a',
    created_at: '2026-01-15T12:00:00.000Z',
    last_used_at: null,
    status: 'active',
  },
  {
    schema: 'v2',
    id: 'preview-v2',
    name: 'SENTINEL edge (masked)',
    key_prefix: 'cc_sentinel_••••••••••••91c0',
    created_at: '2026-01-20T09:30:00.000Z',
    last_used_at: null,
    status: 'active',
  },
]

export default function SecurityPage() {
  const [data, setData] = useState<Sec | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [effectiveTier, setEffectiveTier] = useState('FREE')
  const [keys, setKeys] = useState<KeyRow[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [secretOnce, setSecretOnce] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [keyFormErr, setKeyFormErr] = useState<string | null>(null)
  const [keyName, setKeyName] = useState('Production')
  const [keySchema, setKeySchema] = useState<'v1' | 'v2'>('v1')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadErr(null)
      try {
        const [secRes, meRes] = await Promise.all([
          fetch('/api/dashboard/security', { credentials: 'include' }),
          fetch('/api/dashboard/me', { cache: 'no-store', credentials: 'include' }),
        ])
        const secJson = (await secRes.json().catch(() => null)) as Sec | null
        const meJson = meRes.ok
          ? ((await meRes.json().catch(() => ({}))) as { subscription?: { effectiveTier?: string } })
          : {}
        const meForTier =
          meJson.subscription?.effectiveTier != null ? String(meJson.subscription.effectiveTier) : 'FREE'

        if (!cancelled) {
          if (secJson && typeof secJson.trust_score === 'number') setData(secJson)
          else setLoadErr('Could not load SENTINEL panel.')
          setEffectiveTier(meForTier)
        }

        if (!cancelled) {
          if (!isFreeTier(meForTier)) {
            const kRes = await fetch('/api/v1/keys', { credentials: 'include' })
            const kj = (await kRes.json().catch(() => ({}))) as { keys?: KeyRow[] }
            if (!cancelled && kRes.ok && Array.isArray(kj.keys)) setKeys(kj.keys)
          } else {
            setKeys(FREE_PLACEHOLDER_KEYS)
          }
        }
      } catch {
        if (!cancelled) setLoadErr('Network error loading security data.')
      } finally {
        if (!cancelled) setKeysLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!secretOnce) return
    const t = window.setTimeout(() => setSecretOnce(null), 120_000)
    return () => window.clearTimeout(t)
  }, [secretOnce])

  async function createKey(e: React.FormEvent) {
    e.preventDefault()
    if (isFreeTier(effectiveTier)) return
    setKeyFormErr(null)
    setSecretOnce(null)
    const res = await fetch('/api/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: keyName, schema: keySchema }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setKeyFormErr(typeof j.error === 'string' && j.error ? j.error : 'Failed to create key')
      return
    }
    setSecretOnce(j.rawKey || j.secret || null)
    setCopiedKey(false)
    const kRes = await fetch('/api/v1/keys', { credentials: 'include' })
    const kj = (await kRes.json().catch(() => ({}))) as { keys?: KeyRow[] }
    if (kRes.ok && Array.isArray(kj.keys)) setKeys(kj.keys)
  }

  async function copySecretOnce() {
    if (!secretOnce) return
    const ok = await copyToClipboard(secretOnce)
    setCopiedKey(ok)
  }

  const showPlaceholderUi = isFreeTier(effectiveTier)
  const displayKeys = showPlaceholderUi ? FREE_PLACEHOLDER_KEYS : keys

  if (!data && !loadErr) {
    return <p className="text-sm font-medium tracking-wide text-slate-500">Loading SENTINEL and credentials…</p>
  }
  if (loadErr || !data) {
    return <p className="text-sm font-medium text-rose-300/95">{loadErr ?? 'Something went wrong.'}</p>
  }

  const rows = (data.alerts.length > 0 ? data.alerts : data.recent_events ?? []).slice(0, 40)

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">SENTINEL + credentials</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-200">Security &amp; API keys</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
          Issue and rotate keys alongside threat telemetry. FREE tier shows a full layout with masked sample keys — upgrade
          to provision working credentials.
        </p>
      </header>

      <section className="space-y-6" aria-labelledby="api-keys-heading">
        <h2 id="api-keys-heading" className="sr-only">
          API keys
        </h2>
        <GlassCard className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">Credentials</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-200">API keys</h3>
            </div>
            <Link
              href="/docs"
              className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300 transition-all hover:border-cyan-500/25 hover:bg-cyan-500/[0.06] hover:text-cyan-200/95"
            >
              Documentation
            </Link>
          </div>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-400">
            <span className="text-slate-300">v1</span> (<code className="text-emerald-400/90">cc_live_*</code>) — standard
            access.
            <span className="mx-2 text-slate-600">|</span>
            <span className="text-slate-300">v2 SENTINEL</span> (
            <code className="text-cyan-400/90">cc_sentinel_*</code>) — Pro / Enterprise intelligence routes.
          </p>

          {showPlaceholderUi && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
              <p className="text-sm font-medium text-amber-100/95">Sample keys — upgrade to reveal and activate live quotas.</p>
              <Link
                href="/dashboard/billing"
                className="inline-flex rounded-lg border border-amber-400/40 bg-amber-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-50 transition-colors hover:bg-amber-500/30"
              >
                Upgrade to reveal
              </Link>
            </div>
          )}

          {!showPlaceholderUi && (
            <form onSubmit={(e) => void createKey(e)} className="mt-6">
              <p className="text-sm font-semibold text-slate-200">Provision credential</p>
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-[0.65rem] font-medium uppercase tracking-[0.16em] text-slate-500">Label</label>
                  <input
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="mt-2 min-w-[200px] rounded-lg border border-white/[0.08] bg-black/35 px-3 py-2 text-sm font-medium text-slate-200 outline-none transition-colors duration-150 focus:border-emerald-500/35 focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[0.65rem] font-medium uppercase tracking-[0.16em] text-slate-500">Schema</label>
                  <select
                    value={keySchema}
                    onChange={(e) => setKeySchema(e.target.value as 'v1' | 'v2')}
                    className="mt-2 rounded-lg border border-white/[0.08] bg-black/35 px-3 py-2 text-sm font-medium text-slate-200 outline-none focus:border-emerald-500/35"
                  >
                    <option value="v1">v1 — Free</option>
                    <option value="v2">v2 — Pro / Enterprise</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 transition-all hover:bg-emerald-500/25"
                >
                  Generate
                </button>
              </div>
              {keyFormErr && <p className="mt-3 text-sm font-medium text-rose-300/95">{keyFormErr}</p>}
              {secretOnce && (
                <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] p-4 font-mono text-xs text-amber-100/95">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Copy now — shown once</span>
                    <button
                      type="button"
                      onClick={() => void copySecretOnce()}
                      className="rounded-md border border-amber-400/30 bg-amber-950/30 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-amber-100 hover:bg-amber-950/50"
                    >
                      {copiedKey ? 'Copied' : 'Copy key'}
                    </button>
                  </div>
                  <div className="mt-2 break-all text-amber-50/95">{secretOnce}</div>
                </div>
              )}
            </form>
          )}
        </GlassCard>

        <GlassCard className="overflow-hidden p-0">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Issued credentials</p>
            {Boolean(data.preview) && (
              <p className="mt-1 text-[0.65rem] font-medium text-slate-500">Guest preview — sign in for your real key list.</p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/[0.06] bg-white/[0.02] text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Schema</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Prefix</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Last used</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {keysLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : displayKeys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                      No credentials yet.
                    </td>
                  </tr>
                ) : (
                  displayKeys.map((k) => (
                    <tr
                      key={`${k.schema}-${k.id}`}
                      className="border-b border-white/[0.04] transition-colors duration-100 hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-3 font-mono text-xs font-medium text-slate-400">{k.schema}</td>
                      <td className="px-5 py-3 font-medium text-slate-300">{k.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{k.key_prefix}</td>
                      <td className="px-5 py-3 tabular-nums text-slate-500">
                        {new Date(k.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-slate-500">
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-emerald-300/95">{showPlaceholderUi ? 'preview' : k.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>

      <header className="max-w-2xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">SENTINEL</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-200">Security intelligence</h2>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">{data.trust_note}</p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6">
          <GlassCard accent="sentinel" className="p-6">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-500">Trust index</p>
            <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-emerald-300/95">{data.trust_score}</p>
            <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500">
              Heuristic — strengthen with edge TLS and device attestation in production environments.
            </p>
          </GlassCard>
        </div>
        <div className="col-span-12 md:col-span-6">
          <GlassCard className="p-6">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-500">Active anomalies</p>
            <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-amber-200/90">{data.alerts.length}</p>
            <p className="mt-3 text-xs font-medium text-slate-500">Denied keys, scan faults, and policy violations.</p>
          </GlassCard>
        </div>

        <div className="col-span-12">
          <GlassCard className="overflow-hidden p-0">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">Threat event stream</p>
              <p className="mt-1 text-xs font-medium text-slate-400">Timestamped intelligence — severity color-coded</p>
            </div>
            <ul className="max-h-[420px] divide-y divide-white/[0.04] overflow-y-auto">
              {rows.length === 0 ? (
                <li className="px-5 py-10 text-center text-xs font-medium text-slate-500">
                  No threat events recorded in this window.
                </li>
              ) : (
                rows.map((e, i) => {
                  const sev = severity(e.action)
                  return (
                    <motion.li
                      key={e.created_at + e.action + i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1], delay: i * 0.015 }}
                      className={`border-l-2 px-4 py-3 font-mono text-[0.68rem] leading-snug ${rowClass(sev)}`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="tabular-nums text-slate-500">
                          {new Date(e.created_at).toLocaleString()}
                        </span>
                        <span className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{sev}</span>
                      </div>
                      <div className="mt-1.5 text-slate-300">{e.action}</div>
                    </motion.li>
                  )
                })
              )}
            </ul>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
