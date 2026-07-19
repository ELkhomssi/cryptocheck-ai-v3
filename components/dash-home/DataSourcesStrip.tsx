'use client'

import { useEffect, useState } from 'react'
import { SourceBrandIcon } from './SourceBrandIcon'

type SourcesPayload = {
  telegram: { live: boolean; channelCount: number }
  txodds?: { live: boolean }
}

/**
 * Live chips: Telegram (token CAs) + TxODDS (live sports odds — match_event only).
 */
export function DataSourcesStrip() {
  const [sources, setSources] = useState<SourcesPayload | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/command-center/sources', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setSources(j as SourcesPayload))
      .catch(() => setSources({ telegram: { live: false, channelCount: 0 }, txodds: { live: false } }))
  }, [])

  const tgLive = sources?.telegram.live ?? false
  const count = sources?.telegram.channelCount
  const txLive = sources?.txodds?.live ?? false

  return (
    <section className="dash-glass rounded-dash border border-dash-hairline px-4 py-3 md:px-5">
      <p className="mb-2 font-space text-[11px] font-medium uppercase tracking-[0.14em] text-dash-green">
        Data Sources
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-2 rounded-dash-chip border px-3 py-1.5 text-xs ${
            tgLive
              ? 'border-dash-green/30 bg-dash-green/5 text-dash-thi'
              : 'border-dash-innerline text-dash-tlo opacity-45'
          }`}
        >
          <span className="text-dash-sky">
            <SourceBrandIcon id="telegram" />
          </span>
          <span className={tgLive ? 'text-dash-sky' : ''}>Telegram</span>
          <span className="font-dash-mono text-[11px] text-dash-tlo">
            {sources ? `${count ?? 0} Channels` : '…'}
          </span>
        </span>
        <span
          className={`inline-flex items-center gap-2 rounded-dash-chip border px-3 py-1.5 text-xs ${
            txLive
              ? 'border-dash-gold/40 bg-dash-gold/10 text-dash-thi'
              : 'border-dash-innerline text-dash-tlo opacity-45'
          }`}
        >
          {txLive ? (
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-dash-gold" aria-hidden />
          ) : null}
          <span className={txLive ? 'text-dash-gold' : ''}>TxODDS</span>
          <span className="font-dash-mono text-[11px] text-dash-tlo">
            {txLive ? 'LIVE' : 'offline'}
          </span>
        </span>
      </div>
    </section>
  )
}
