'use client'

/**
 * Terminal OS Alerts — create rules, show fired history, poll evaluate against live feeds.
 */

import { useCallback, useEffect, useState } from 'react'
import { Panel } from '@/features/terminal-os/shared/components/Panel'
import { EmptyState, PanelSkeleton } from '@/features/terminal-os/shared/components/PanelStates'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { AlertRule, FiredAlert } from '@/lib/terminal-os/alert-types'
import { createPriceAlertFromToken } from '@/features/terminal-os/alerts/create-price-alert'

export function AlertsWorkspace() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const setNotificationCount = useTerminalOsStore((s) => s.setNotificationCount)
  const focused = useTerminalOsStore((s) => s.focusedToken)

  const [rules, setRules] = useState<AlertRule[] | null>(null)
  const [fired, setFired] = useState<FiredAlert[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [threshold, setThreshold] = useState('1')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!wallet) {
      setRules([])
      setFired([])
      return
    }
    const res = await fetch(`/api/terminal-os/alerts?wallet=${encodeURIComponent(wallet)}`)
    if (!res.ok) throw new Error('Failed to load alerts')
    const body = (await res.json()) as { rules: AlertRule[]; fired: FiredAlert[] }
    setRules(body.rules ?? [])
    setFired(body.fired ?? [])
    setNotificationCount((body.fired ?? []).filter((f) => f.delivered).length)
  }, [wallet, setNotificationCount])

  useEffect(() => {
    let c = false
    void refresh().catch((e: Error) => {
      if (!c) setError(e.message)
    })
    return () => {
      c = true
    }
  }, [refresh])

  // Refresh history when global evaluate bridge fires
  useEffect(() => {
    const onAlert = () => {
      void refresh()
    }
    window.addEventListener('ccai:tos:alert', onAlert)
    return () => window.removeEventListener('ccai:tos:alert', onAlert)
  }, [refresh])

  const createPriceRule = async () => {
    if (!wallet || !focused) return
    setBusy(true)
    setError(null)
    try {
      await createPriceAlertFromToken({
        wallet,
        token: focused,
        thresholdUsd: Number(threshold) || 0,
      })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  if (!wallet) {
    return (
      <Panel title="Alerts">
        <EmptyState message="Connect a wallet to create and receive live alert rules." />
      </Panel>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Panel title="Create rule from context">
        {focused ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="tos-muted" style={{ fontSize: 'var(--tos-fs-xs)', margin: 0 }}>
              Notify when ${focused.symbol} price &gt; threshold (USD)
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="tos-input tos-num"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                aria-label="Price threshold"
              />
              <button
                type="button"
                className="tos-btn tos-btn-gold"
                disabled={busy}
                onClick={() => void createPriceRule()}
              >
                Notify me
              </button>
            </div>
          </div>
        ) : (
          <EmptyState message="Focus a token on the chart, then create a Notify-me rule here." />
        )}
      </Panel>

      <Panel title="Active rules" live>
        {error ? <EmptyState message={error} /> : null}
        {rules == null ? (
          <PanelSkeleton rows={2} />
        ) : rules.length === 0 ? (
          <EmptyState message="No active rules yet." />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rules.map((r) => (
              <li key={r.id} style={{ fontSize: 'var(--tos-fs-sm)', borderLeft: '2px solid var(--tos-accent-gold)', paddingLeft: 8 }}>
                <strong>{r.type}</strong> · {r.target.symbol ?? r.target.id.slice(0, 8)} ·{' '}
                {r.condition.field} {r.condition.operator} {String(r.condition.value)}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Fired history" live>
        {fired == null ? (
          <PanelSkeleton rows={3} />
        ) : fired.length === 0 ? (
          <EmptyState message="No fired alerts yet — rules evaluate against live price feeds." />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fired.map((f) => (
              <li key={f.id} style={{ fontSize: 'var(--tos-fs-sm)' }}>
                <div>{f.summary}</div>
                <div className="tos-muted tos-num" style={{ fontSize: 'var(--tos-fs-xs)' }}>
                  {new Date(f.firedAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
