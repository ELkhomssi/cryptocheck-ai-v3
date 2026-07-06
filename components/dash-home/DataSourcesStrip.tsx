'use client'

import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { SourceBrandIcon, type SourceBrandId } from './SourceBrandIcon'

type SourceChip = {
  id: SourceBrandId | 'txodds'
  name: string
  sub?: string
  live: boolean
  accent?: string
}

const INTEGRATION_SOON: SourceChip[] = [
  { id: 'x', name: 'X (Twitter)', live: false },
  { id: 'dexscreener', name: 'DEX Screener', live: false },
  { id: 'pumpfun', name: 'Pump.fun', live: false },
  { id: 'coinmarketcap', name: 'CoinMarketCap', live: false },
  { id: 'coingecko', name: 'CoinGecko', live: false },
  { id: 'whale', name: 'Whale Wallets', live: false },
  { id: 'smartmoney', name: 'Smart Money', live: false },
  { id: 'news', name: 'News Feeds', live: false },
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

  const live: SourceChip[] = [
    {
      id: 'telegram',
      name: 'Telegram',
      sub: sources ? `${sources.telegram.channelCount} Channels` : '…',
      live: sources?.telegram.live ?? false,
      accent: 'text-dash-sky',
    },
    {
      id: 'txodds',
      name: 'TxODDS',
      sub: sources?.txodds.live ? 'LIVE' : 'offline',
      live: sources?.txodds.live ?? false,
      accent: 'text-dash-orangeTx',
    },
  ]

  return (
    <section className="rounded-dash border border-dash-hairline bg-dash-panel px-4 py-3 md:px-5">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-dash-tlo">Data Sources</p>
      <div className="flex flex-wrap items-center gap-2">
        {live.map((c) => (
          <Chip key={c.id} chip={c} />
        ))}
        {INTEGRATION_SOON.map((c) => (
          <Chip key={c.id} chip={c} soon />
        ))}
        <button
          type="button"
          onClick={() => setCustomizeOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-dash-chip border border-dash-innerline px-3 py-1.5 text-xs text-dash-tmid transition-colors duration-150 hover:border-white/20 hover:text-dash-thi focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Customize
        </button>
      </div>
      {customizeOpen ? (
        <p className="mt-3 rounded-dash-inner border border-dash-innerline bg-dash-panel2 px-3 py-2 text-xs text-dash-tmid">
          Only Telegram and TxODDS are live today. Other sources appear as Soon until integrated.
        </p>
      ) : null}
    </section>
  )
}

function Chip({ chip, soon }: { chip: SourceChip; soon?: boolean }) {
  const muted = soon || !chip.live
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-dash-chip border px-3 py-1.5 text-xs ${
        muted
          ? 'border-dash-innerline text-dash-tlo opacity-40'
          : 'border-dash-innerline bg-dash-panel2 text-dash-thi'
      }`}
    >
      {chip.id === 'txodds' && chip.live ? (
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-dash-orangeTx" aria-hidden />
      ) : chip.id !== 'txodds' ? (
        <span className={chip.accent ?? 'text-dash-tmid'}>
          <SourceBrandIcon id={chip.id as SourceBrandId} />
        </span>
      ) : null}
      <span className={!muted && chip.accent ? chip.accent : ''}>{chip.name}</span>
      {chip.sub ? <span className="font-dash-mono text-[11px] text-dash-tlo">{chip.sub}</span> : null}
      {soon ? <span className="text-[9px] font-bold uppercase text-dash-tlo">Soon</span> : null}
    </span>
  )
}
