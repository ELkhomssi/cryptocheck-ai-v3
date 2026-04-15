'use client'

import { useCallback, useEffect, useState } from 'react'
import { GlassCard } from '@/components/Dashboard/GlassCard'

type KeyRow = {
  schema: 'v1' | 'v2'
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  status: 'active' | 'revoked'
  key_id?: string
  tier?: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('Production')
  const [schema, setSchema] = useState<'v1' | 'v2'>('v1')
  const [secretOnce, setSecretOnce] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/v1/keys', { credentials: 'include' })
    const j = await res.json().catch(() => ({}))
    if (res.ok && Array.isArray(j.keys)) setKeys(j.keys)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createKey(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSecretOnce(null)
    const res = await fetch('/api/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, schema }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setErr(j.error || 'Failed to create key')
      return
    }
    setSecretOnce(j.rawKey || j.secret || null)
    void load()
  }

  async function revokeKey(k: KeyRow) {
    if (!confirm('Revoke this key? Apps using it will fail immediately.')) return
    const qs = new URLSearchParams({ id: k.id, schema: k.schema })
    const res = await fetch(`/api/v1/keys?${qs}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) void load()
  }

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Credentials</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-200">API keys</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-400">
          <span className="text-slate-300">v1</span> (<code className="text-emerald-400/90">cc_live_*</code>) — standard
          access.
          <span className="mx-2 text-slate-600">|</span>
          <span className="text-slate-300">v2 SENTINEL</span> (
          <code className="text-cyan-400/90">cc_sentinel_*</code>) — Pro / Enterprise intelligence routes.
        </p>
      </header>

      <GlassCard className="p-6">
        <h2 className="text-sm font-semibold text-slate-200">Provision credential</h2>
        <form onSubmit={createKey} className="mt-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[0.65rem] font-medium uppercase tracking-[0.16em] text-slate-500">
                Label
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 min-w-[200px] rounded-lg border border-white/[0.08] bg-black/35 px-3 py-2 text-sm font-medium text-slate-200 outline-none transition-colors duration-150 focus:border-emerald-500/35 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-[0.65rem] font-medium uppercase tracking-[0.16em] text-slate-500">
                Schema
              </label>
              <select
                value={schema}
                onChange={(e) => setSchema(e.target.value as 'v1' | 'v2')}
                className="mt-2 rounded-lg border border-white/[0.08] bg-black/35 px-3 py-2 text-sm font-medium text-slate-200 outline-none transition-colors duration-150 focus:border-emerald-500/35"
              >
                <option value="v1">v1 — Free</option>
                <option value="v2">v2 — Pro / Enterprise</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-emerald-500/25"
            >
              Generate
            </button>
          </div>
          {err && <p className="mt-4 text-sm font-medium text-rose-300/95">{err}</p>}
          {secretOnce && (
            <div className="mt-5 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] p-4 font-mono text-xs text-amber-100/95">
              Copy now — shown once:
              <div className="mt-2 break-all text-amber-50/95">{secretOnce}</div>
            </div>
          )}
        </form>
      </GlassCard>

      <GlassCard className="overflow-hidden p-0">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Issued credentials</p>
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
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                    No credentials yet.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
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
                      <span
                        className={
                          k.status === 'active'
                            ? 'font-medium text-emerald-300/95'
                            : 'text-slate-600 line-through'
                        }
                      >
                        {k.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {k.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => void revokeKey(k)}
                          className="text-xs font-semibold text-rose-300/90 transition-colors hover:text-rose-200"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
