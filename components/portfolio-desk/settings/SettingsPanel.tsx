'use client'

/**
 * Settings — real controls (Phase 12.4).
 * Account · Appearance · Notifications · API & Data · Danger zone.
 */

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSolana } from '@/components/SolanaProvider'
import { FilterChip } from '@/components/portfolio-desk/ui/FilterChip'
import { usePortfolioTheme } from '@/store/portfolio-theme'
import type { AlertPreference, PortfolioAlertType } from '@/types/portfolio-desk'

const ALERT_TYPES: { id: PortfolioAlertType; label: string }[] = [
  { id: 'whale_buy', label: 'Whale buy' },
  { id: 'whale_sell', label: 'Whale sell' },
  { id: 'liquidity_added', label: 'Liquidity added' },
  { id: 'liquidity_removed', label: 'Liquidity removed' },
  { id: 'smart_money_entry', label: 'Smart money in' },
  { id: 'smart_money_exit', label: 'Smart money out' },
  { id: 'new_listing', label: 'New listing' },
  { id: 'new_token_launch', label: 'New launch' },
  { id: 'rug_risk', label: 'Rug risk' },
  { id: 'mint_authority', label: 'Mint authority' },
  { id: 'freeze_authority', label: 'Freeze authority' },
  { id: 'large_holder_distribution', label: 'Holder distribution' },
  { id: 'risk', label: 'Risk' },
  { id: 'whale', label: 'Whale' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'smart_money', label: 'Smart money' },
  { id: 'dev_wallet', label: 'Dev wallet' },
]

type ProviderProbe = {
  id: string
  label: string
  ok: boolean
  configured: boolean
  latencyMs: number | null
  detail: string
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pd-panel" style={{ marginBottom: 16 }}>
      <div className="pd-panel-head">
        <h2>{title}</h2>
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

export function SettingsPanel({
  onOpenIntelligence,
}: {
  onOpenIntelligence?: () => void
} = {}) {
  const { walletAddress, shortAddr, isConnected, connect, disconnect } = useSolana()
  const theme = usePortfolioTheme((s) => s.theme)
  const setTheme = usePortfolioTheme((s) => s.setTheme)
  const qc = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<'clear_watchlist' | 'clear_alerts' | null>(
    null,
  )
  const [dangerMsg, setDangerMsg] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const prefsQ = useQuery({
    queryKey: ['portfolio-alert-prefs', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [] as AlertPreference[]
      const res = await fetch(
        `/api/portfolio/alerts/preferences?wallet=${encodeURIComponent(walletAddress)}`,
        { cache: 'no-store' },
      )
      if (!res.ok) return []
      const body = (await res.json()) as { preferences?: AlertPreference[] }
      return body.preferences ?? []
    },
    enabled: Boolean(walletAddress),
  })

  const healthQ = useQuery({
    queryKey: ['terminal-provider-health'],
    queryFn: async () => {
      const res = await fetch('/api/terminal/provider-health', { cache: 'no-store' })
      if (!res.ok) throw new Error('health probe failed')
      return (await res.json()) as { providers: ProviderProbe[]; fetchedAt: string }
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const prefMap = useMemo(() => {
    const m = new Map<PortfolioAlertType, boolean>()
    for (const p of prefsQ.data ?? []) m.set(p.alertType, p.enabled)
    return m
  }, [prefsQ.data])

  const toggleMut = useMutation({
    mutationFn: async (p: AlertPreference) => {
      const res = await fetch('/api/portfolio/alerts/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, preferences: [p] }),
      })
      if (!res.ok) throw new Error('Failed to save preference')
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portfolio-alert-prefs', walletAddress] })
    },
  })

  const dangerMut = useMutation({
    mutationFn: async (action: 'clear_watchlist' | 'clear_alerts') => {
      const res = await fetch('/api/terminal/settings/danger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          confirm: true,
          walletAddress: walletAddress ?? undefined,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; deleted?: number }
      if (!res.ok) throw new Error(body.error || 'Action failed')
      return body
    },
    onSuccess: (body, action) => {
      setDangerMsg(
        action === 'clear_watchlist'
          ? `Watchlist cleared${body.deleted != null ? ` (${body.deleted})` : ''}.`
          : `Alert history cleared${body.deleted != null ? ` (${body.deleted})` : ''}.`,
      )
      setConfirmAction(null)
      void qc.invalidateQueries({ queryKey: ['terminal-watchlist'] })
      void qc.invalidateQueries({ queryKey: ['portfolio-alerts'] })
    },
    onError: (e) => {
      setDangerMsg((e as Error).message)
      setConfirmAction(null)
    },
  })

  useEffect(() => {
    // Ensure html data-theme matches store on mount (no FOUC when navigating in-desk).
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <section>
      <Section title="Account">
        {isConnected && walletAddress ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>
                Connected wallet
              </div>
              <div className="pd-num" style={{ fontSize: 13, wordBreak: 'break-all' }}>
                {walletAddress}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                Short · {shortAddr}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Plan</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Free
                <span style={{ fontWeight: 400, color: 'var(--text-faint)', marginLeft: 8 }}>
                  (session tier — Pro gates live on dashboard account)
                </span>
              </div>
            </div>
            <button type="button" className="pd-tab" onClick={() => void disconnect()}>
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
              Connect a Solana wallet to personalize alerts and portfolio tools.
            </p>
            <button type="button" className="pd-connect" onClick={() => void connect()}>
              Connect Wallet
            </button>
          </div>
        )}
      </Section>

      <Section title="Appearance">
        <div className="pd-chip-row">
          {(['dark', 'light'] as const).map((t) => (
            <FilterChip key={t} selected={theme === t} onClick={() => setTheme(t)}>
              {t === 'dark' ? 'Dark' : 'Light'}
            </FilterChip>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 10 }}>
          Signal-blue palette (Phase 19). Persists via `ccai-portfolio-theme` on{' '}
          <span className="pd-num">data-theme</span>. Legacy brass remains as{' '}
          <span className="pd-num">brass</span> / <span className="pd-num">brass-light</span> for
          rollback until cleanup.
        </p>
      </Section>

      <Section title="Notifications">
        {!walletAddress ? (
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Connect a wallet to persist alert preferences to Supabase.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ALERT_TYPES.map((t) => {
              const on = prefMap.get(t.id) !== false
              return (
                <label
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-soft)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <span>{t.label}</span>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={toggleMut.isPending}
                    onChange={() =>
                      toggleMut.mutate({ alertType: t.id, enabled: !on })
                    }
                  />
                </label>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="API & Data">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(healthQ.data?.providers ?? []).map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: p.ok ? 'var(--positive)' : 'var(--negative)',
                  flexShrink: 0,
                }}
                aria-hidden
              />
              <strong style={{ minWidth: 72 }}>{p.label}</strong>
              <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                {p.detail}
                {p.latencyMs != null ? ` · ${p.latencyMs}ms` : ''}
              </span>
            </div>
          ))}
          {healthQ.isLoading ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Probing providers…</div>
          ) : null}
          {healthQ.isError ? (
            <div style={{ color: 'var(--negative)', fontSize: 12 }}>
              Could not reach health endpoint.
            </div>
          ) : null}
          <button
            type="button"
            className="pd-tab"
            onClick={() => void healthQ.refetch()}
            disabled={healthQ.isFetching}
          >
            Refresh
          </button>
        </div>
      </Section>

      <Section title="Advanced · Intelligence Engine">
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
          Employee roster, orchestrator runs, and performance calibration. Relocated from primary
          nav — full Phase 11 functionality intact.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="pd-tab"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            {advancedOpen ? 'Hide path' : 'Show advanced path'}
          </button>
          <button
            type="button"
            className="pd-connect"
            onClick={() => {
              if (onOpenIntelligence) onOpenIntelligence()
              else window.location.assign('/settings/intelligence-engine')
            }}
          >
            Open Intelligence Engine
          </button>
          <a href="/ai-employees" className="pd-tab" style={{ display: 'inline-flex', alignItems: 'center' }}>
            Legacy /ai-employees
          </a>
        </div>
        {advancedOpen ? (
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-faint)' }}>
            Deep links: <span className="pd-num">/terminalOS?nav=ai-workforce</span> ·{' '}
            <span className="pd-num">/settings/intelligence-engine</span>
          </p>
        ) : null}
      </Section>

      <Section title="Danger zone">
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 12 }}>
          These actions permanently delete data. Confirmation is required.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="pd-tab"
            style={{ color: 'var(--negative)' }}
            onClick={() => setConfirmAction('clear_watchlist')}
          >
            Clear watchlist
          </button>
          <button
            type="button"
            className="pd-tab"
            style={{ color: 'var(--negative)' }}
            onClick={() => setConfirmAction('clear_alerts')}
          >
            Clear alert history
          </button>
        </div>
        {dangerMsg ? (
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>{dangerMsg}</p>
        ) : null}

        {confirmAction ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              marginTop: 14,
              padding: 14,
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface-2)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Confirm {confirmAction === 'clear_watchlist' ? 'clear watchlist' : 'clear alerts'}?
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
              This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="pd-connect"
                disabled={dangerMut.isPending}
                onClick={() => dangerMut.mutate(confirmAction)}
              >
                {dangerMut.isPending ? 'Working…' : 'Confirm'}
              </button>
              <button
                type="button"
                className="pd-tab"
                disabled={dangerMut.isPending}
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Section>
    </section>
  )
}
