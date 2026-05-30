'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { WEB4_BASE_PATH } from '@/lib/web4/routes'
import type { ProtocolStats } from '@/lib/web4/protocol/types'
import { GRADUATION_LAMPORTS, LAMPORTS_PER_SOL } from '@/lib/web4/bonding-curve/constants'

function formatVolume(lamports: string, solUsd: number): string {
  const sol = Number(BigInt(lamports)) / Number(LAMPORTS_PER_SOL)
  const usd = sol * solUsd
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(1)}K`
  return `$${usd.toFixed(0)}`
}

export function Web4ProtocolSection() {
  const [stats, setStats] = useState<ProtocolStats | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/web4/protocol/stats', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as ProtocolStats
        if (!cancelled) setStats(data)
      } catch {
        /* ignore */
      }
    }
    void load()
    const id = window.setInterval(load, 30_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const volume = stats ? formatVolume(stats.totalVolumeLamports, stats.solUsd) : '—'
  const graduated = stats?.tokensGraduated ?? '—'
  const whales = stats?.connectedWalletsEstimate ?? '—'
  const capSol = Number(GRADUATION_LAMPORTS / LAMPORTS_PER_SOL)

  return (
    <section
      id="web4-protocol"
      style={{
        padding: 'clamp(56px,9vw,96px) clamp(16px,4vw,32px)',
        background: '#111',
        borderTop: '1px solid #2a2a2a',
        borderBottom: '1px solid #2a2a2a',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: '#86efac',
              marginBottom: 12,
            }}
          >
            WEB4 PROTOCOL
          </div>
          <h2
            style={{
              fontSize: 'clamp(24px,3.5vw,36px)',
              fontWeight: 800,
              color: '#fff',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            The Institutional Meme Launchpad
          </h2>
          <p style={{ fontSize: 14, color: '#888', lineHeight: 1.7, marginTop: 14, maxWidth: 560 }}>
            Real SOL bonding curves, revoked mint authority, and automated Raydium graduation at {capSol}{' '}
            SOL — built by CryptoCheck for production liquidity.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 28,
            padding: 16,
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 12,
          }}
        >
          {[
            { label: 'Total volume secured', value: volume },
            { label: 'Graduated to Raydium', value: String(graduated) },
            { label: 'Active curve pools', value: String(stats?.activePools ?? '—') },
            { label: 'Whales connected', value: String(whales) },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#86efac' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <Link
          href={WEB4_BASE_PATH}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 28px',
            fontSize: 14,
            fontWeight: 700,
            background: '#86efac',
            color: '#000',
            borderRadius: 8,
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}
        >
          Enter Web4 Terminal →
        </Link>
        {stats?.source ? (
          <p style={{ marginTop: 12, fontSize: 11, color: '#666' }}>
            Live metrics · source: {stats.source}
          </p>
        ) : null}
      </div>
    </section>
  )
}
