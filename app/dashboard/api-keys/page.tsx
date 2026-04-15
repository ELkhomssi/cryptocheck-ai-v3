'use client'

import { useCallback, useEffect, useState } from 'react'

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
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-semibold text-white">API keys</h1>
        <p className="mt-1 max-w-xl text-sm text-zinc-500">
          <span className="text-zinc-300">v1</span> (<code className="text-emerald-400/90">cc_live_*</code>) — free tier.
          <span className="mx-2 text-zinc-600">|</span>
          <span className="text-zinc-300">v2 SENTINEL</span> (<code className="text-emerald-400/90">cc_sentinel_*</code>) — Pro /
          Enterprise.
        </p>
      </div>

      <form onSubmit={createKey} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
        <h2 className="text-sm font-medium text-zinc-300">Create key</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-zinc-500">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 rounded-md border border-white/[0.1] bg-black/40 px-3 py-2 font-mono text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">Schema</label>
            <select
              value={schema}
              onChange={(e) => setSchema(e.target.value as 'v1' | 'v2')}
              className="mt-1 rounded-md border border-white/[0.1] bg-black/40 px-3 py-2 font-mono text-sm text-white"
            >
              <option value="v1">v1 — Free</option>
              <option value="v2">v2 — Pro / Enterprise</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Generate
          </button>
        </div>
        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
        {secretOnce && (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 font-mono text-xs text-amber-100">
            Copy now — shown once:
            <div className="mt-2 break-all text-amber-50">{secretOnce}</div>
          </div>
        )}
      </form>

      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Schema</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Prefix</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last used</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  Loading…
                </td>
              </tr>
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No keys yet.
                </td>
              </tr>
            ) : (
              keys.map((k) => (
                <tr key={`${k.schema}-${k.id}`} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-zinc-300">{k.schema}</td>
                  <td className="px-4 py-3">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">{k.key_prefix}</td>
                  <td className="px-4 py-3 text-zinc-500">{new Date(k.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        k.status === 'active' ? 'text-emerald-400' : 'text-zinc-500 line-through'
                      }
                    >
                      {k.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {k.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => void revokeKey(k)}
                        className="text-xs text-red-400 hover:underline"
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
    </div>
  )
}
