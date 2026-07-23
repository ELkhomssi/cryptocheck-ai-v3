'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Droplets, Fish, Sparkles, Waves } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { relativeAge } from '@/lib/portfolio-desk/format'
import type { PortfolioAlert } from '@/types/portfolio-desk'

async function fetchAlerts(wallet: string | null): Promise<PortfolioAlert[]> {
  const q = wallet ? `?wallet=${encodeURIComponent(wallet)}` : ''
  const res = await fetch(`/api/portfolio/alerts${q}`, { cache: 'no-store' })
  if (!res.ok) return []
  const body = (await res.json()) as { alerts?: PortfolioAlert[] }
  return body.alerts ?? []
}

function iconFor(type: PortfolioAlert['type']) {
  if (type === 'liquidity') return Droplets
  if (type === 'dev_wallet') return Waves
  if (type === 'smart_money') return Sparkles
  if (type === 'risk') return AlertTriangle
  return Fish
}

function tone(type: PortfolioAlert['type']) {
  if (type === 'liquidity') return { bg: 'var(--pd-positive-soft)', c: 'var(--pd-positive)' }
  if (type === 'dev_wallet' || type === 'smart_money')
    return { bg: 'var(--pd-accent-soft)', c: 'var(--pd-accent-bright)' }
  if (type === 'risk') return { bg: 'var(--pd-negative-soft)', c: 'var(--pd-negative)' }
  return { bg: 'rgba(156,140,255,0.14)', c: 'var(--pd-chain)' }
}

export function AlertsPanel() {
  const { walletAddress } = useSolana()
  const { data: alerts = [] } = useQuery({
    queryKey: ['portfolio-alerts', walletAddress],
    queryFn: () => fetchAlerts(walletAddress),
    refetchInterval: 20_000,
    staleTime: 15_000,
  })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section>
      <div className="pd-panel-head" style={{ padding: '0 4px 14px', border: 'none' }}>
        <h2>AI Alerts</h2>
        <span style={{ fontSize: 12, color: 'var(--pd-accent)', fontWeight: 600 }}>
          {alerts.length ? `${alerts.length}` : 'Live'}
        </span>
      </div>

      {!alerts.length ? (
        <p style={{ fontSize: 12.5, color: 'var(--pd-text-faint)', padding: '4px 4px 16px' }}>
          No webhook alerts yet. Configure Helius →{' '}
          <span className="pd-num">/api/webhooks/helius-portfolio</span>. Nothing is fabricated.
        </p>
      ) : (
        alerts.map((a) => {
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
