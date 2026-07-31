'use client'

/**
 * Listens for ccai:tos:alert CustomEvents and shows a transient toast + badge bump.
 */

import { useEffect, useState } from 'react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { FiredAlert } from '@/lib/terminal-os/alert-types'

export function AlertToastHost() {
  const setNotificationCount = useTerminalOsStore((s) => s.setNotificationCount)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const onAlert = (ev: Event) => {
      const detail = (ev as CustomEvent<FiredAlert>).detail
      if (!detail?.summary) return
      setToast(detail.summary)
      const n = useTerminalOsStore.getState().notificationCount
      setNotificationCount(n + 1)
      window.setTimeout(() => setToast(null), 5_000)
    }
    window.addEventListener('ccai:tos:alert', onAlert)
    return () => window.removeEventListener('ccai:tos:alert', onAlert)
  }, [setNotificationCount])

  if (!toast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 80,
        maxWidth: 360,
        padding: '10px 14px',
        background: 'var(--tos-bg-panel-elevated)',
        border: '1px solid color-mix(in srgb, var(--tos-accent-gold) 45%, transparent)',
        borderRadius: 8,
        fontSize: 'var(--tos-fs-sm)',
        boxShadow: 'var(--shadow-md, 0 8px 24px rgba(0,0,0,0.35))',
      }}
    >
      <strong style={{ color: 'var(--tos-accent-gold)', display: 'block', marginBottom: 4 }}>
        Alert fired
      </strong>
      {toast}
    </div>
  )
}
