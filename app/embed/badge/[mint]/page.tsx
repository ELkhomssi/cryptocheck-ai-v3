import { notFound } from 'next/navigation'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { getLiveBadgePayload, verdictColor } from '@/lib/revenue-dashboard/verified-badge'

export const dynamic = 'force-dynamic'

type Props = { params: { mint: string } }

/** Minimal iframe embed — live verdict from gateway (paid badges only). */
export default async function EmbedBadgePage({ params }: Props) {
  const mint = decodeURIComponent(params.mint).trim()
  if (!isValidSolanaMint(mint)) notFound()

  const badge = await getLiveBadgePayload(mint)
  if (!badge) {
    return (
      <div
        style={{
          fontFamily: 'system-ui, sans-serif',
          background: '#0B1220',
          color: '#8B9BB4',
          padding: '12px 14px',
          fontSize: 12,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        No verified badge for this token.
      </div>
    )
  }

  const color = verdictColor(badge.verdict)

  return (
    <a
      href={badge.reportUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        textDecoration: 'none',
        fontFamily: 'system-ui, sans-serif',
        background: '#0B1220',
        color: '#E8EDF5',
        padding: '12px 14px',
        borderRadius: 8,
        border: `1px solid ${color}44`,
        boxSizing: 'border-box',
        maxWidth: 320,
      }}
    >
      <span
        style={{
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color,
        }}
      >
        {badge.verdict}
      </span>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 20, fontWeight: 600 }}>
        {badge.safetyScore}
        <span style={{ fontSize: 12, color: '#8B9BB4' }}>/100</span>
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#6B7A94', maxWidth: 90, textAlign: 'right' }}>
        CryptoCheck · paid scan
      </span>
    </a>
  )
}
