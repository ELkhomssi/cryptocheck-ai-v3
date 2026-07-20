'use client'

import { useEffect, useState } from 'react'
import { SourceBrandIcon } from './SourceBrandIcon'

type SourcesPayload = {
  telegram: {
    live: boolean
    channelCount: number
    lastIngestAt?: string | null
    sampleChannels?: string[]
  }
}

function formatAge(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

/**
 * Live Telegram channel feed status — count + heartbeat + last ingest age.
 */
export function DataSourcesStrip() {
  const [sources, setSources] = useState<SourcesPayload | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/command-center/sources', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setSources(j as SourcesPayload))
      .catch(() => setSources({ telegram: { live: false, channelCount: 0 } }))
  }, [])

  const tg = sources?.telegram
  const tgLive = tg?.live ?? false
  const count = tg?.channelCount ?? 0
  const age = formatAge(tg?.lastIngestAt)
  const samples = (tg?.sampleChannels ?? []).slice(0, 3)

  return (
    <section className="dash-glass rounded-dash border border-dash-hairline px-4 py-3 md:px-5">
      <p className="mb-2 font-space text-[11px] font-medium uppercase tracking-[0.14em] text-dash-green">
        Data Sources
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex flex-wrap items-center gap-2 rounded-dash-chip border px-3 py-1.5 text-xs ${
            tgLive
              ? 'border-dash-green/40 bg-dash-green/10 text-dash-thi'
              : 'border-dash-amber/30 bg-dash-amber/5 text-dash-thi'
          }`}
          title={
            tgLive
              ? 'telegram-monitor heartbeat is fresh'
              : 'Channels configured, but telegram-monitor is not heartbeating — restart ingestion'
          }
        >
          {tgLive ? (
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-dash-green" aria-hidden />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-dash-amber" aria-hidden />
          )}
          <span className="text-dash-sky">
            <SourceBrandIcon id="telegram" />
          </span>
          <span className={tgLive ? 'text-dash-sky' : ''}>Telegram</span>
          <span
            className={`font-dash-mono text-[10px] font-bold uppercase tracking-wider ${
              tgLive ? 'text-dash-green' : 'text-dash-amber'
            }`}
          >
            {sources ? (tgLive ? 'LIVE' : 'OFFLINE') : '…'}
          </span>
          <span className="font-dash-mono text-[11px] text-dash-tlo">
            {sources ? `${count} channel${count === 1 ? '' : 's'}` : '…'}
          </span>
          {age ? (
            <span className="font-dash-mono text-[10px] text-dash-tlo">· last {age}</span>
          ) : null}
        </span>
      </div>
      {samples.length > 0 ? (
        <p className="mt-2 font-dash-mono text-[10px] text-dash-tlo">
          e.g. {samples.join(' · ')}
          {count > samples.length ? ` · +${count - samples.length} more` : ''}
        </p>
      ) : null}
      {!tgLive && sources ? (
        <p className="mt-1.5 text-[10px] leading-relaxed text-dash-tmid">
          Channel list is loaded ({count}). Live Alpha needs the{' '}
          <span className="font-dash-mono text-dash-thi">telegram-monitor</span> worker running
          (Railway / droplet).
        </p>
      ) : null}
    </section>
  )
}
