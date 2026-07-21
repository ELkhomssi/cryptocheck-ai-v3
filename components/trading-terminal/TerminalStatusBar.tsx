'use client'

import { useEffect, useState } from 'react'
import { useSolana } from '@/components/SolanaProvider'

export function TerminalStatusBar() {
  const { isConnected } = useSolana()
  const [latency, setLatency] = useState<number | null>(null)
  const [status, setStatus] = useState<'ok' | 'degraded'>('ok')

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const t0 = performance.now()
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        const ms = Math.round(performance.now() - t0)
        if (cancelled) return
        setLatency(ms)
        const body = (await res.json().catch(() => ({}))) as { status?: string }
        setStatus(res.ok && body.status === 'healthy' ? 'ok' : 'degraded')
      } catch {
        if (!cancelled) {
          setStatus('degraded')
          setLatency(null)
        }
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <footer
      className="flex shrink-0 items-center gap-3 overflow-x-auto border-t border-[var(--tit-border)] bg-[var(--tit-bg-1)] px-3 tit-mono text-[0.55rem] text-[var(--tit-text-2)]"
      style={{ height: 'var(--tit-footer)' }}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isConnected ? 'bg-[var(--tit-pos)]' : 'bg-[var(--tit-text-2)]'
          }`}
        />
        {isConnected ? 'WALLET CONNECTED' : 'WALLET OFF'}
      </span>
      <span>
        Solana RPC {latency != null ? `${latency}ms` : '—'}
      </span>
      <span className={status === 'ok' ? 'text-[var(--tit-pos)]' : 'text-[var(--tit-warn)]'}>
        {status === 'ok' ? 'SYSTEMS OK' : 'DEGRADED'}
      </span>
      <span className="ml-auto text-[var(--tit-text-2)]">
        Not financial advice · DYOR · Non-custodial
      </span>
    </footer>
  )
}
