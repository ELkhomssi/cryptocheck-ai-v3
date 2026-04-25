'use client'

import Link from 'next/link'
import useSWR from 'swr'

export type PulseRow = {
  mint: string
  aggregateScore: number
  verdict: string
  institutionalGrade: string
  ts: string
}

const fetcher = async (url: string): Promise<PulseRow[]> => {
  const r = await fetch(url, { cache: 'no-store' })
  const j = (await r.json()) as { feed?: unknown }
  return Array.isArray(j.feed) ? (j.feed as PulseRow[]) : []
}

function shortMint(mint: string): string {
  if (mint.length <= 14) return mint
  return `${mint.slice(0, 6)}…${mint.slice(-4)}`
}

function formatRelative(ts: string): string {
  const t = new Date(ts).getTime()
  if (Number.isNaN(t)) return '—'
  const sec = Math.floor(Math.max(0, Date.now() - t) / 1000)
  if (sec < 60) return `${sec}s ago`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export type PulseFeedProps = {
  onPickMint?: (mint: string) => void
}

export function PulseFeed({ onPickMint }: PulseFeedProps) {
  const { data, error, isLoading } = useSWR<PulseRow[]>('/api/v1/pulse', fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  })

  const rows = data ?? []
  const err = error ? 'Pulse unavailable' : null

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (max-width: 540px) {
          .cc-pulse-row {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 6px !important;
          }
        }
      `,
        }}
      />
      <section
        style={{
          marginTop: 28,
          borderRadius: 14,
          border: '0.5px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(160deg, rgba(99,102,241,0.06) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(16px)',
          padding: 'clamp(16px,3vw,22px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#818cf8' }}>INSTANT PULSE</div>
            <div style={{ fontSize: 13, color: '#e5e7eb', marginTop: 4 }}>Latest institutional-grade scans (global)</div>
          </div>
          <div className="cc-pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} aria-hidden />
        </div>
        {err && <div style={{ marginTop: 10, fontSize: 12, color: '#f87171' }}>{err}</div>}
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {rows.map((row, i) => (
            <button
              key={`${row.mint}-${row.ts}-${i}`}
              type="button"
              className="cc-pulse-row"
              onClick={() => onPickMint?.(row.mint)}
              aria-label={`Load mint ${row.mint} in live scanner`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) auto auto auto auto',
                gap: 10,
                alignItems: 'center',
                padding: '10px 0',
                borderTop: i === 0 ? 'none' : '0.5px solid rgba(255,255,255,0.06)',
                fontSize: 12,
                width: '100%',
                textAlign: 'start',
                background: 'transparent',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                cursor: onPickMint ? 'pointer' : 'default',
                color: 'inherit',
              }}
            >
              <span style={{ color: '#cbd5e1', fontFamily: 'var(--font-geist-mono), monospace', wordBreak: 'break-all' }}>
                {shortMint(row.mint)}
              </span>
              <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{row.institutionalGrade}</span>
              <span style={{ color: '#34d399', whiteSpace: 'nowrap' }}>{row.aggregateScore}</span>
              <span style={{ color: '#a5b4fc', whiteSpace: 'nowrap', fontSize: 11 }}>{row.verdict}</span>
              <span style={{ color: '#64748b', whiteSpace: 'nowrap', fontSize: 10 }} dir="ltr">
                {formatRelative(row.ts)}
              </span>
            </button>
          ))}
          {!rows.length && !err && isLoading && (
            <div style={{ fontSize: 12, color: '#64748b', padding: '8px 0' }}>Loading pulse…</div>
          )}
          {!rows.length && !err && !isLoading && (
            <div style={{ fontSize: 12, color: '#94a3b8', padding: '10px 0', lineHeight: 1.5 }}>
              No recent scans yet —{' '}
              <Link href="#pro-live-scanner" style={{ color: '#6ee7b7' }}>
                run first scan
              </Link>
              .
            </div>
          )}
        </div>
      </section>
    </>
  )
}
