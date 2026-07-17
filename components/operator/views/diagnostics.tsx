'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { SystemHealthPayload } from '@/lib/diagnostics/types'

function statusColor(status: string): string {
  if (status === 'ONLINE') return '#3fb950'
  if (status === 'DEGRADED' || status === 'UNAVAILABLE') return '#d29922'
  if (status === 'OFFLINE') return '#f85149'
  if (status === 'NOT_DEPLOYED') return '#8b949e'
  return '#8b949e'
}

function Card({
  title,
  emoji,
  data,
}: {
  title: string
  emoji: string
  data: Record<string, unknown> | undefined
}) {
  const status = String(data?.status ?? 'UNAVAILABLE')
  const readiness = data?.readiness != null ? Number(data.readiness).toFixed(1) : '—'
  const metrics = (data?.metrics as Record<string, unknown>) ?? {}
  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 10,
        padding: 16,
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 11,
        color: '#c9d1d9',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 12 }}>
          {emoji} {title}
        </span>
        <span style={{ color: statusColor(status), fontWeight: 700 }}>{status}</span>
      </div>
      <div style={{ color: '#6e7681', marginBottom: 8 }}>Readiness: {readiness}%</div>
      <pre
        style={{
          margin: 0,
          maxHeight: 220,
          overflow: 'auto',
          fontSize: 10,
          lineHeight: 1.45,
          color: '#8b949e',
        }}
      >
        {JSON.stringify(metrics, null, 2)}
      </pre>
    </div>
  )
}

export default function AdminDiagnosticsPage() {
  const [data, setData] = useState<SystemHealthPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/diagnostics/system-health', { credentials: 'include' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setData(null)
        setErr(typeof j?.error === 'string' ? j.error : `HTTP ${res.status}`)
        return
      }
      setData(j as SystemHealthPayload)
    } catch (e) {
      setData(null)
      setErr(e instanceof Error ? e.message : 'Fetch failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 10_000)
    return () => clearInterval(id)
  }, [load])

  const exportJson = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `system-health-${new Date().toISOString().slice(0, 19)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const cats = (data?.categories as Record<string, Record<string, unknown>>) ?? {}
  const overall = data?.overall_readiness

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>System diagnostics</h1>
            <p style={{ margin: '8px 0 0', color: '#8b949e', fontSize: 13 }}>
              Read-only · auto-refresh 10s ·{' '}
              <Link href="/admin" style={{ color: '#58a6ff' }}>
                ← Admin
              </Link>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: '#8b949e' }}>
              Overall:{' '}
              <strong style={{ color: '#3fb950' }}>{overall != null ? `${Number(overall).toFixed(1)}%` : '—'}</strong>
            </span>
            <button
              type="button"
              onClick={() => void load()}
              style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #30363d', background: '#21262d', color: '#c9d1d9', cursor: 'pointer' }}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={exportJson}
              disabled={!data}
              style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #238636', background: '#238636', color: '#fff', cursor: data ? 'pointer' : 'not-allowed' }}
            >
              Export JSON
            </button>
          </div>
        </div>

        {loading && !data && <div style={{ color: '#8b949e' }}>Loading…</div>}
        {err && <div style={{ color: '#f85149', marginBottom: 16 }}>{err}</div>}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14, marginBottom: 20 }}>
              <Card title="Neural scanner v4 stack" emoji="🧠" data={cats.neural_scanner as Record<string, unknown>} />
              <Card title="Portfolio engine" emoji="💰" data={cats.portfolio_engine as Record<string, unknown>} />
              <Card title="WebSocket service" emoji="🔌" data={cats.websocket_service as Record<string, unknown>} />
              <Card title="Alert engine" emoji="⚡" data={cats.alert_engine as Record<string, unknown>} />
              <Card title="Database (Supabase)" emoji="💾" data={cats.database as Record<string, unknown>} />
              <Card
                title="Readiness matrix"
                emoji="🎯"
                data={{
                  status: 'ONLINE',
                  readiness: overall != null ? Number(overall) : null,
                  metrics: (cats.system_readiness ?? {}) as Record<string, unknown>,
                }}
              />
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Warnings</div>
              <pre style={{ margin: 0, fontSize: 10, color: '#8b949e', fontFamily: "'IBM Plex Mono',monospace" }}>
                {JSON.stringify(data.alerts ?? [], null, 2)}
              </pre>
              <div style={{ fontWeight: 700, margin: '14px 0 8px' }}>Collection errors</div>
              <pre style={{ margin: 0, fontSize: 10, color: '#8b949e', fontFamily: "'IBM Plex Mono',monospace" }}>
                {JSON.stringify(data.collection_errors ?? [], null, 2)}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
