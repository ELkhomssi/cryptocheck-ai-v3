'use client'

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, Date.now() - t)
  const sec = Math.floor(diff / 1000)
  if (sec < 45) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function confidenceWord(c01: number): string {
  const p = Math.round(c01 * 100)
  if (p >= 80) return 'High'
  if (p >= 50) return 'Medium'
  return 'Low'
}

type Props = {
  rpcProvider: string
  lastUpdatedIso: string
  confidence01: number
  cache?: 'hit' | 'miss'
}

/**
 * Thin institutional trust row — complements technical RPC telemetry elsewhere.
 */
export function EnterpriseTrustStrip({ rpcProvider, lastUpdatedIso, confidence01, cache }: Props) {
  const rel = formatRelativeTime(lastUpdatedIso)
  const conf = confidenceWord(confidence01)

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px 20px',
        padding: '10px 16px',
        marginBottom: 20,
        borderRadius: 12,
        border: '0.5px solid rgba(16,185,129,0.12)',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        fontSize: 11,
        letterSpacing: '0.06em',
        color: '#94a3b8',
      }}
    >
      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Audit Ready</span>
      <span style={{ opacity: 0.35 }}>·</span>
      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>API Verified</span>
      <span style={{ opacity: 0.35 }}>·</span>
      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Real-time Scan</span>
      <span style={{ opacity: 0.35 }}>|</span>
      <span>
        Source <span style={{ color: '#6ee7b7', fontFamily: 'ui-monospace, monospace' }}>{rpcProvider}</span>
      </span>
      <span style={{ opacity: 0.35 }}>|</span>
      <span>
        Updated <span style={{ color: '#e2e8f0' }}>{rel}</span>
      </span>
      <span style={{ opacity: 0.35 }}>|</span>
      <span>
        Confidence <span style={{ color: '#6ee7b7' }}>{conf}</span>
      </span>
      {cache ? (
        <>
          <span style={{ opacity: 0.35 }}>|</span>
          <span>
            Cache <span style={{ color: cache === 'hit' ? '#34d399' : '#fbbf24' }}>{cache === 'hit' ? 'warm' : 'fresh'}</span>
          </span>
        </>
      ) : null}
    </div>
  )
}
