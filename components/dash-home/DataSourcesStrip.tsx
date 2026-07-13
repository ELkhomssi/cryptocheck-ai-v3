'use client'

import { useEffect, useState } from 'react'
import { SourceBrandIcon } from './SourceBrandIcon'

type SourcesPayload = {
  telegram: { live: boolean; channelCount: number }
}

/**
 * Telegram-only source chip — X / TxODDS / other integrations hidden until wired live.
 */
export function DataSourcesStrip() {
  const [sources, setSources] = useState<SourcesPayload | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/command-center/sources', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setSources(j as SourcesPayload))
      .catch(() => setSources({ telegram: { live: false, channelCount: 0 } }))
  }, [])

  const live = sources?.telegram.live ?? false
  const count = sources?.telegram.channelCount
  const muted = !live

  return (
    <section className="dash-glass rounded-dash border border-dash-hairline px-4 py-3 md:px-5">
      <p className="mb-2 font-space text-[11px] font-medium uppercase tracking-[0.14em] text-dash-green">
        Data Sources
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-2 rounded-dash-chip border px-3 py-1.5 text-xs ${
            muted
              ? 'border-dash-innerline text-dash-tlo opacity-45'
              : 'border-dash-green/30 bg-dash-green/5 text-dash-thi'
          }`}
        >
          <span className="text-dash-sky">
            <SourceBrandIcon id="telegram" />
          </span>
          <span className={muted ? '' : 'text-dash-sky'}>Telegram</span>
          <span className="font-dash-mono text-[11px] text-dash-tlo">
            {sources ? `${count ?? 0} Channels` : '…'}
          </span>
        </span>
      </div>
    </section>
  )
}
