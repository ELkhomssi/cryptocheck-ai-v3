'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import type { ScanV1ApiResponse } from '@/lib/types/institutional-scan-api'
import { LiveScoreDisplay, type LivePerfMeta } from '@/components/pro/LiveScoreDisplay'

const FEATURED: { label: string; mint: string }[] = [
  { label: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
  { label: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { label: 'JUP', mint: 'JUPyiwrYJFv1mHSSge9dB8EjzzxZrMciSJAThvB6mZe' },
  { label: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
]

function scanApiErrorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Request failed'
  const o = data as Record<string, unknown>
  if (typeof o.message === 'string') return o.message
  const err = o.error
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message?: unknown }).message ?? 'Request failed')
  }
  return 'Request failed'
}

export type HeroScannerProps = {
  /** When user picks a row in Instant Pulse, parent sets mint here. */
  prefillMint?: string | null
  onPrefillConsumed?: () => void
  onLiveResult: (scan: ScanV1ApiResponse, perf: LivePerfMeta, mint: string) => void
  /** Initial reasoning for score card before first scan */
  initialScore: number
  initialVerdict: ScanV1ApiResponse['reasoning']['verdict']
  initialConfidence: number
  hasApiAccess?: boolean
  restrictionTooltip?: string
  userHeliusApiKey?: string | null
}

export function HeroScanner({
  prefillMint,
  onPrefillConsumed,
  onLiveResult,
  initialScore,
  initialVerdict,
  initialConfidence,
  hasApiAccess = true,
  restrictionTooltip = 'Action restricted: API Key required.',
  userHeliusApiKey = null,
}: HeroScannerProps) {
  const formId = useId()
  const [mint, setMint] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<ScanV1ApiResponse | null>(null)
  const [perf, setPerf] = useState<LivePerfMeta | null>(null)

  useEffect(() => {
    if (!prefillMint?.trim()) return
    setMint(prefillMint.trim())
    onPrefillConsumed?.()
  }, [prefillMint, onPrefillConsumed])

  const runScan = useCallback(async () => {
    const trimmed = mint.trim()
    if (trimmed.length < 32) {
      setError('Enter a valid Solana mint address.')
      return
    }
    setLoading(true)
    setError(null)
    const t0 = performance.now()
    try {
      const r = await fetch('/api/v1/scan/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userHeliusApiKey ? { 'X-Helius-Api-Key': userHeliusApiKey } : {}),
        },
        body: JSON.stringify({ mint: trimmed }),
      })
      const j = (await r.json()) as ScanV1ApiResponse | Record<string, unknown>
      if (!r.ok) {
        const msg = scanApiErrorMessage(j)
        if (r.status === 429) throw new Error(`${msg} Try again after a short wait.`)
        throw new Error(msg)
      }
      const scan = j as ScanV1ApiResponse
      const responseTimeMs = Math.round(performance.now() - t0)
      const hdrCache = r.headers.get('X-Cache-Hit')
      const cacheHit = hdrCache === 'true' ? true : hdrCache === 'false' ? false : null
      const hdrMs = r.headers.get('X-Response-Time-Ms')
      const serverMs = hdrMs ? parseInt(hdrMs, 10) : responseTimeMs
      const p: LivePerfMeta = {
        responseTimeMs: Number.isFinite(serverMs) ? serverMs : responseTimeMs,
        cacheHit,
        rpcLabel: scan.rpc_provider,
        lastUpdatedIso: scan.last_updated,
      }
      setLive(scan)
      setPerf(p)
      onLiveResult(scan, p, trimmed)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scan failed')
      setLive(null)
      setPerf(null)
    } finally {
      setLoading(false)
    }
  }, [mint, onLiveResult, userHeliusApiKey])

  const displayScan = live
  const score = displayScan?.score ?? initialScore
  const verdict = displayScan?.reasoning.verdict ?? initialVerdict
  const confidence = displayScan?.confidence ?? initialConfidence

  return (
    <div id="pro-live-scanner" style={{ marginBottom: 'clamp(12px,3vw,20px)' }}>
      <div
        style={{
          borderRadius: 14,
          border: '0.5px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.03)',
          padding: 'clamp(14px,3vw,18px)',
          marginBottom: 14,
        }}
      >
        <label htmlFor={formId} style={{ fontSize: 10, letterSpacing: '0.14em', color: '#64748b' }}>
          LIVE SCANNER
        </label>
        <p style={{ margin: '6px 0 12px', fontSize: 12, color: '#94a3b8' }}>
          Paste any Solana mint address to run a live institutional scan (no login).
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {FEATURED.map((f) => (
            <button
              key={f.mint}
              type="button"
              aria-label={`Autofill ${f.label} mint`}
              onClick={() => {
                setMint(f.mint)
                setError(null)
              }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 8,
                border: '0.5px solid rgba(0,212,170,0.35)',
                background: 'rgba(0,212,170,0.08)',
                color: '#00d4aa',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'stretch' }}>
          <input
            id={formId}
            dir="ltr"
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            placeholder="Mint address…"
            spellCheck={false}
            autoComplete="off"
            aria-label="Solana mint address"
            style={{
              flex: '1 1 220px',
              minWidth: 0,
              padding: '12px 14px',
              borderRadius: 10,
              border: '0.5px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.35)',
              color: '#e2e8f0',
              fontSize: 13,
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            }}
          />
          <button
            type="button"
            onClick={() => void runScan()}
            disabled={loading || !hasApiAccess}
            title={!hasApiAccess ? restrictionTooltip : undefined}
            style={{
              padding: '12px 22px',
              borderRadius: 10,
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.06em',
              cursor: loading ? 'wait' : !hasApiAccess ? 'not-allowed' : 'pointer',
              color: '#020617',
              background:
                loading || !hasApiAccess
                  ? 'rgba(16,185,129,0.45)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            }}
          >
            {loading ? 'Scanning…' : 'Run scan'}
          </button>
        </div>
        {!hasApiAccess ? (
          <p style={{ marginTop: 10, fontSize: 12, color: '#fbbf24' }}>{restrictionTooltip}</p>
        ) : null}
        {error ? (
          <p style={{ marginTop: 10, fontSize: 12, color: '#f87171' }} role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <LiveScoreDisplay
        targetScore={score}
        verdict={verdict}
        confidence={confidence}
        perf={perf}
        loading={loading}
        placeholder="Scan any token to see live score and verdict."
      />
    </div>
  )
}
