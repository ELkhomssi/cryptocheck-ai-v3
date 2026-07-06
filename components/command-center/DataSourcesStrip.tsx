'use client'

import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'

type SourceChip = { id: string; label: string; detail?: string; live: boolean; color?: string }

const SOON_CHIPS: SourceChip[] = [
  { id: 'x', label: 'X', live: false },
  { id: 'dex', label: 'DEX Screener', live: false },
  { id: 'pump', label: 'Pump.fun', live: false },
  { id: 'cmc', label: 'CoinMarketCap', live: false },
  { id: 'cg', label: 'CoinGecko', live: false },
  { id: 'whale', label: 'Whale Wallets', live: false },
  { id: 'news', label: 'News Feeds', live: false },
]

type SourcesPayload = {
  telegram: { live: boolean; channelCount: number }
  txodds: { live: boolean }
}

export function DataSourcesStrip() {
  const [sources, setSources] = useState<SourcesPayload | null>(null)
  const [customizeOpen, setCustomizeOpen] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/command-center/sources', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setSources(j as SourcesPayload))
      .catch(() => setSources({ telegram: { live: false, channelCount: 0 }, txodds: { live: false } }))
  }, [])

  const liveChips: SourceChip[] = [
    {
      id: 'telegram',
      label: 'Telegram',
      detail: sources ? `${sources.telegram.channelCount} Channels` : '…',
      live: sources?.telegram.live ?? false,
      color: 'var(--cc-sky)',
    },
    {
      id: 'txodds',
      label: 'TxODDS',
      detail: sources?.txodds.live ? 'LIVE' : 'offline',
      live: sources?.txodds.live ?? false,
      color: 'var(--cc-orange)',
    },
  ]

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-6">
        {liveChips.map((chip) => (
          <Chip key={chip.id} chip={chip} />
        ))}
        {SOON_CHIPS.map((chip) => (
          <Chip key={chip.id} chip={chip} />
        ))}
        <button
          type="button"
          onClick={() => setCustomizeOpen((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-[var(--cc-inner)] px-3 py-1.5 text-xs text-[var(--cc-mid)] hover:text-[var(--cc-hi)]"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Customize
        </button>
      </div>

      {customizeOpen ? (
        <div className="mx-4 mb-3 cc-panel-2 px-4 py-3 text-xs text-[var(--cc-mid)] md:mx-6">
          Source customization is coming soon. Live sources reflect your deployed ingestion config.
        </div>
      ) : null}
    </div>
  )
}

function Chip({ chip }: { chip: SourceChip }) {
  const muted = !chip.live
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
        muted
          ? 'border border-[var(--cc-inner)] text-[var(--cc-lo)] opacity-60'
          : 'border border-[var(--cc-hairline)] bg-[var(--cc-panel-2)] text-[var(--cc-hi)]'
      }`}
    >
      {chip.live ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-[var(--cc-green)] shadow-[0_0_6px_rgba(123,232,75,0.6)]"
          aria-hidden
        />
      ) : null}
      <span style={chip.color && chip.live ? { color: chip.color } : undefined}>{chip.label}</span>
      {chip.detail ? <span className="cc-mono text-[0.62rem] text-[var(--cc-lo)]">{chip.detail}</span> : null}
      {muted && !chip.detail ? (
        <span className="cc-label text-[0.48rem] text-[var(--cc-lo)]">Soon</span>
      ) : null}
    </span>
  )
}
