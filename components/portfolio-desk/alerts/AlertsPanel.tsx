'use client'

/**
 * AI Alerts feed — Phase 13 layout + chip hierarchy.
 * Three breathable sections (header / filters / preferences), no enclosing dark card.
 * Chips use FilterChip (soft selected) — never solid accent fill.
 */

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Droplets,
  Fish,
  Rocket,
  Sparkles,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { FilterChip } from '@/components/portfolio-desk/ui/FilterChip'
import { relativeAge } from '@/lib/portfolio-desk/format'
import type { AlertPreference, PortfolioAlert, PortfolioAlertType } from '@/types/portfolio-desk'

const CHIP_TYPES: { id: PortfolioAlertType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'whale_buy', label: 'Whale buy' },
  { id: 'whale_sell', label: 'Whale sell' },
  { id: 'liquidity_added', label: 'Liq+' },
  { id: 'liquidity_removed', label: 'Liq−' },
  { id: 'smart_money_entry', label: 'SM in' },
  { id: 'smart_money_exit', label: 'SM out' },
  { id: 'new_listing', label: 'Listing' },
  { id: 'new_token_launch', label: 'Launch' },
  { id: 'rug_risk', label: 'Rug' },
  { id: 'mint_authority', label: 'Mint auth' },
  { id: 'freeze_authority', label: 'Freeze' },
  { id: 'large_holder_distribution', label: 'Holder dist' },
  { id: 'risk', label: 'Risk' },
  { id: 'whale', label: 'Whale' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'smart_money', label: 'Smart $' },
  { id: 'dev_wallet', label: 'Dev' },
]

async function fetchAlerts(wallet: string | null): Promise<PortfolioAlert[]> {
  const q = wallet ? `?wallet=${encodeURIComponent(wallet)}` : ''
  const res = await fetch(`/api/portfolio/alerts${q}`, { cache: 'no-store' })
  if (!res.ok) return []
  const body = (await res.json()) as { alerts?: PortfolioAlert[] }
  return body.alerts ?? []
}

async function fetchPrefs(wallet: string | null): Promise<AlertPreference[]> {
  if (!wallet) return []
  const res = await fetch(
    `/api/portfolio/alerts/preferences?wallet=${encodeURIComponent(wallet)}`,
    { cache: 'no-store' },
  )
  if (!res.ok) return []
  const body = (await res.json()) as { preferences?: AlertPreference[] }
  return body.preferences ?? []
}

type Tone = { bg: string; fg: string }

function iconFor(type: PortfolioAlert['type']): LucideIcon {
  if (type === 'liquidity' || type === 'liquidity_added' || type === 'liquidity_removed') {
    return Droplets
  }
  if (type === 'dev_wallet' || type === 'mint_authority' || type === 'freeze_authority') {
    return Waves
  }
  if (type === 'smart_money' || type === 'smart_money_entry' || type === 'smart_money_exit') {
    return Sparkles
  }
  if (type === 'risk' || type === 'rug_risk' || type === 'large_holder_distribution') {
    return AlertTriangle
  }
  if (type === 'new_listing' || type === 'new_token_launch') return Rocket
  return Fish
}

function toneFor(type: PortfolioAlert['type']): Tone {
  if (type === 'liquidity' || type === 'liquidity_added') {
    return { bg: 'var(--positive-soft)', fg: 'var(--positive)' }
  }
  if (type === 'liquidity_removed' || type === 'whale_sell' || type === 'smart_money_exit') {
    return { bg: 'var(--negative-soft)', fg: 'var(--negative)' }
  }
  if (
    type === 'dev_wallet' ||
    type === 'smart_money' ||
    type === 'smart_money_entry' ||
    type === 'new_listing' ||
    type === 'new_token_launch'
  ) {
    return { bg: 'var(--accent-soft)', fg: 'var(--accent-bright)' }
  }
  if (
    type === 'risk' ||
    type === 'rug_risk' ||
    type === 'mint_authority' ||
    type === 'freeze_authority'
  ) {
    return { bg: 'var(--negative-soft)', fg: 'var(--negative)' }
  }
  return { bg: 'var(--chain-soft)', fg: 'var(--chain)' }
}

function AlertRow({ alert, now }: { alert: PortfolioAlert; now: number }) {
  const Icon = iconFor(alert.type)
  const tone = toneFor(alert.type)
  return (
    <li className="pd-alert-row">
      <span className="pd-alert-badge" style={{ background: tone.bg, color: tone.fg }} aria-hidden>
        <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
      </span>
      <div className="pd-alert-body">
        <div className="pd-alert-title">{alert.title}</div>
        <div className="pd-alert-desc">{alert.description}</div>
      </div>
      <time className="pd-alert-time" dateTime={alert.createdAt}>
        {relativeAge(alert.createdAt, now)}
      </time>
    </li>
  )
}

export function AlertsPanel() {
  const { walletAddress } = useSolana()
  const qc = useQueryClient()
  const [chip, setChip] = useState<PortfolioAlertType | 'all'>('all')
  const [now, setNow] = useState(() => Date.now())

  const { data: alerts = [] } = useQuery({
    queryKey: ['portfolio-alerts', walletAddress],
    queryFn: () => fetchAlerts(walletAddress),
    refetchInterval: 20_000,
    staleTime: 15_000,
  })

  const { data: prefs = [] } = useQuery({
    queryKey: ['portfolio-alert-prefs', walletAddress],
    queryFn: () => fetchPrefs(walletAddress),
    enabled: Boolean(walletAddress),
    staleTime: 30_000,
  })

  const toggleMut = useMutation({
    mutationFn: async (p: AlertPreference) => {
      const res = await fetch('/api/portfolio/alerts/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          preferences: [p],
        }),
      })
      if (!res.ok) throw new Error('Failed to save preference')
      return res.json()
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portfolio-alert-prefs', walletAddress] })
    },
  })

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const enabled = useMemo(() => {
    if (!prefs.length) return null
    return new Set(prefs.filter((p) => p.enabled).map((p) => p.alertType))
  }, [prefs])

  const filtered = useMemo(() => {
    let list = alerts
    if (enabled) list = list.filter((a) => enabled.has(a.type))
    if (chip !== 'all') list = list.filter((a) => a.type === chip)
    return list
  }, [alerts, enabled, chip])

  const prefMap = useMemo(() => {
    const m = new Map<PortfolioAlertType, boolean>()
    for (const p of prefs) m.set(p.alertType, p.enabled)
    return m
  }, [prefs])

  return (
    <section className="pd-alerts">
      {/* 1. Header — same panel-head pattern as AI Coach */}
      <div className="pd-alerts-section" style={{ paddingTop: 0 }}>
        <div className="pd-panel-head" style={{ padding: '0 0 0', border: 'none' }}>
          <h2>AI Alerts</h2>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
            {filtered.length ? `${filtered.length}` : 'Live'}
          </span>
        </div>
      </div>

      {/* 2. Filter chips */}
      <div className="pd-alerts-section" role="tablist" aria-label="Alert type filter">
        <div className="pd-chip-row">
          {CHIP_TYPES.map((c) => (
            <FilterChip
              key={c.id}
              selected={chip === c.id}
              role="tab"
              aria-selected={chip === c.id}
              onClick={() => setChip(c.id)}
            >
              {c.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* 3. Preferences */}
      {walletAddress && prefs.length ? (
        <div className="pd-alerts-section">
          <div className="pd-alerts-label">Preferences</div>
          <div className="pd-chip-row">
            {CHIP_TYPES.filter((c) => c.id !== 'all').map((c) => {
              const on = prefMap.get(c.id as PortfolioAlertType) !== false
              return (
                <FilterChip
                  key={`pref-${c.id}`}
                  selected={on}
                  disabled={toggleMut.isPending}
                  title={on ? `Disable ${c.label}` : `Enable ${c.label}`}
                  onClick={() =>
                    toggleMut.mutate({
                      alertType: c.id as PortfolioAlertType,
                      enabled: !on,
                    })
                  }
                >
                  {c.label}
                </FilterChip>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Feed */}
      <div className="pd-alerts-section" style={{ paddingBottom: 0 }}>
        {!filtered.length ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-faint)', margin: 0 }}>
            No webhook alerts yet. Configure Helius →{' '}
            <span className="pd-num">/api/webhooks/helius</span>. Nothing is fabricated.
          </p>
        ) : (
          <ul className="pd-alert-list">
            {filtered.map((a) => (
              <AlertRow key={a.id} alert={a} now={now} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
