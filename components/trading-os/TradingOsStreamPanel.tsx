'use client'

import React from 'react'
import { useTradingOsStreamEvents } from '@/hooks/useTradingOsStreamEvents'

type Props = {
  enabled: boolean
}

/**
 * Live portfolio snapshot channel (HTTP poll ~5s, or WS when configured).
 */
export default function TradingOsStreamPanel({ enabled }: Props) {
  const { data, pollHttpError } = useTradingOsStreamEvents(enabled)

  if (!enabled) return null

  const errLine =
    pollHttpError === 401
      ? 'Stream unauthorized — sign in again.'
      : pollHttpError != null
        ? `Stream HTTP ${pollHttpError}`
        : null

  return (
    <div
      style={{
        marginTop: 14,
        padding: '12px 14px',
        borderRadius: 8,
        border: '1px solid rgba(32,178,170,0.25)',
        background: 'rgba(32,178,170,0.06)',
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: 10,
        color: '#8b949e',
      }}
    >
      <div style={{ fontWeight: 700, color: '#20b2aa', letterSpacing: '0.08em', marginBottom: 6 }}>TRADING OS STREAM</div>
      {errLine && <div style={{ color: '#ff6b6b', marginBottom: 6 }}>{errLine}</div>}
      {!errLine && !data && <div>Connecting…</div>}
      {data && (
        <div style={{ lineHeight: 1.6 }}>
          <div>
            Server time: <span style={{ color: '#c9d1d9' }}>{data.serverTime}</span>
          </div>
          <div>
            Portfolio rows: <span style={{ color: '#c9d1d9' }}>{data.portfolios.length}</span>
          </div>
          {data.portfolios[0] && (
            <div style={{ marginTop: 4, color: '#6e7681' }}>
              Latest mint: {data.portfolios[0].mint.slice(0, 4)}…{data.portfolios[0].mint.slice(-4)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
