'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Droplets,
  Fish,
  Rocket,
  Sparkles,
  Waves,
} from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
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

function iconFor(type: PortfolioAlert['type']) {
  if (type === 'liquidity' || type === 'liquidity_added' || type === 'liquidity_removed') {
    return Droplets
  }
  if (type === 'dev_wallet' || type === 'mint_authority' || type === 'freeze_authority') {
    return Waves
  }
  if (
    type === 'smart_money' ||
    type === 'smart_money_entry' ||
    type === 'smart_money_exit'
  ) {
    return Sparkles
  }
  if (type === 'risk' || type === 'rug_risk' || type === 'large_holder_distribution') {
    return AlertTriangle
  }
  if (type === 'new_listing' || type === 'new_token_launch') return Rocket
  return Fish
}

function tone(type: PortfolioAlert['type']) {
  if (type === 'liquidity' || type === 'liquidity_added') {
    return { bg: 'var(--pd-positive-soft)', c: 'var(--pd-positive)' }
  }
  if (type === 'liquidity_removed' || type === 'whale_sell' || type === 'smart_money_exit') {
    return { bg: 'var(--pd-negative-soft)', c: 'var(--pd-negative)' }
  }
  if (
    type === 'dev_wallet' ||
    type === 'smart_money' ||
    type === 'smart_money_entry' ||
    type === 'new_listing' ||
    type === 'new_token_launch'
  ) {
    return { bg: 'var(--pd-accent-soft)', c: 'var(--pd-accent-bright)' }
  }
  if (
    type === 'risk' ||
    type === 'rug_risk' ||
    type === 'mint_authority' ||
    type === 'freeze_authority'
  ) {
    return { bg: 'var(--pd-negative-soft)', c: 'var(--pd-negative)' }
  }
  return { bg: 'var(--pd-chain-soft)', c: 'var(--pd-chain)' }
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
    <section>
      <div className="pd-panel-head" style={{ padding: '0 4px 14px', border: 'none' }}>
        <h2>AI Alerts</h2>
        <span style={{ fontSize: 12, color: 'var(--pd-accent)', fontWeight: 600 }}>
          {filtered.length ? `${filtered.length}` : 'Live'}
        </span>
      </div>

      <div
        className="pd-tabs"
        style={{ flexWrap: 'wrap', marginBottom: 10, gap: 4 }}
        role="tablist"
        aria-label="Alert type filter"
      >
        {CHIP_TYPES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={chip === c.id}
            className={`pd-tab${chip === c.id ? ' is-active' : ''}`}
            onClick={() => setChip(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {walletAddress && prefs.length ? (
        <div style={{ marginBottom: 12, padding: '0 4px' }}>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: '0.06em',
              color: 'var(--pd-text-faint)',
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            PREFERENCES
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CHIP_TYPES.filter((c) => c.id !== 'all').map((c) => {
              const on = prefMap.get(c.id as PortfolioAlertType) !== false
              return (
                <button
                  key={`pref-${c.id}`}
                  type="button"
                  className={`pd-tab${on ? ' is-active' : ''}`}
                  disabled={toggleMut.isPending}
                  title={on ? `Disable ${c.label}` : `Enable ${c.label}`}
                  onClick={() =>
                    toggleMut.mutate({
                      alertType: c.id as PortfolioAlertType,
                      enabled: !on,
                    })
                  }
                >
                  {on ? '✓ ' : ''}
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {!filtered.length ? (
        <p style={{ fontSize: 12.5, color: 'var(--pd-text-faint)', padding: '4px 4px 16px' }}>
          No webhook alerts yet. Configure Helius →{' '}
          <span className="pd-num">/api/webhooks/helius</span>. Nothing is fabricated.
        </p>
      ) : (
        filtered.map((a) => {
          const Icon = iconFor(a.type)
          const t = tone(a.type)
          return (
            <div key={a.id} className="pd-alert-item">
              <div className="pd-al-icon" style={{ background: t.bg, color: t.c }}>
                <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="pd-al-title">{a.title}</div>
                <div className="pd-al-desc">{a.description}</div>
              </div>
              <div className="pd-al-time pd-num">{relativeAge(a.createdAt, now)}</div>
            </div>
          )
        })
      )}
    </section>
  )
}
