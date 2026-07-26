'use client'

import {
  Bot,
  FileSearch,
  Fish,
  MessageSquare,
  Newspaper,
  Rocket,
  Scale,
  Search,
  Shield,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { AgentDataSource, AgentIconTone, RosterEmployeeView } from '@/types/agents'
import { PerformanceRing } from './PerformanceRing'
import { StatusDot } from './StatusDot'

const ICONS: Record<string, LucideIcon> = {
  MessageSquare,
  FileSearch,
  TrendingUp,
  Fish,
  Shield,
  Newspaper,
  Rocket,
  Scale,
  Search,
  Bot,
}

const TONE_BG: Record<AgentIconTone, string> = {
  gold: 'var(--pd-accent-soft)',
  green: 'var(--pd-positive-soft)',
  red: 'var(--pd-negative-soft)',
  chain: 'var(--pd-chain-soft)',
  accent: 'var(--pd-accent-soft)',
}

const TONE_FG: Record<AgentIconTone, string> = {
  gold: 'var(--pd-accent)',
  green: 'var(--pd-positive)',
  red: 'var(--pd-negative)',
  chain: 'var(--pd-chain)',
  accent: 'var(--pd-accent-bright)',
}

const SOURCE_LABEL: Partial<Record<AgentDataSource, string>> = {
  'jupiter-price': 'Jupiter',
  'birdeye-ohlcv': 'OHLCV',
  'birdeye-token': 'Token',
  'birdeye-screener': 'Screener',
  'birdeye-new-listings': 'Listings',
  'raydium-pools': 'Raydium',
  'helius-metadata': 'Helius',
  'helius-webhooks': 'Webhooks',
  'portfolio-analytics': 'Portfolio',
  'portfolio-alerts': 'Alerts',
  'news-sentiment': 'News',
}

export function EmployeeCard({
  employee,
  online,
  busy,
  onAction,
}: {
  employee: RosterEmployeeView
  online: boolean | null
  busy?: boolean
  onAction: () => void
}) {
  const Icon = ICONS[employee.icon] || Bot
  const tone = employee.iconTone
  const calibrating = employee.performance.calibrating

  return (
    <article className="pd-mcard" style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 196 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            background: TONE_BG[tone],
            color: TONE_FG[tone],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {employee.name}
            </div>
            <StatusDot online={online} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--pd-text-dim)', marginTop: 3, lineHeight: 1.35 }}>
            {employee.role}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <PerformanceRing score={employee.performance.score} calibrating={calibrating} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: 'var(--pd-text-faint)', marginBottom: 4 }}>
            {calibrating ? 'Calibrating' : 'Performance'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--pd-text-dim)', lineHeight: 1.35 }}>
            {employee.currentActivity}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {employee.dataSources.slice(0, 4).map((s) => (
          <span
            key={s}
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-ibm-plex-mono), monospace',
              color: 'var(--pd-text-faint)',
              border: '1px solid var(--pd-border)',
              borderRadius: 4,
              padding: '2px 6px',
            }}
          >
            {SOURCE_LABEL[s] || s}
          </span>
        ))}
      </div>

      <button
        type="button"
        className="pd-connect"
        style={{ width: '100%', marginTop: 'auto' }}
        disabled={busy || online === false}
        onClick={onAction}
      >
        {busy ? 'Running…' : employee.actionLabel}
      </button>
    </article>
  )
}
