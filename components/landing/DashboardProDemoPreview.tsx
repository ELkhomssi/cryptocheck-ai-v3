'use client'

import { useState } from 'react'
import { ForDevelopersBadge } from '@/components/landing/ForDevelopersBadge'

type DemoTab = 'scan' | 'evidence' | 'api'

const TABS: Array<{ id: DemoTab; label: string }> = [
  { id: 'scan', label: 'Scan' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'api', label: 'API' },
]

const EVIDENCE = [
  { label: 'Liquidity', detail: 'Pool depth OK · thin-order risk low', tone: '#34d399' },
  { label: 'Wallet cluster', detail: 'No linked scam funding hits', tone: '#34d399' },
  { label: 'Contract', detail: 'Mint / freeze authority reviewed', tone: '#fbbf24' },
]

/**
 * Scaled-down interactive preview of Dashboard Pro for the landing page.
 * Keeps the live product out of the iframe path (operator-gated) while
 * still letting visitors poke the chrome.
 */
export function DashboardProDemoPreview() {
  const [tab, setTab] = useState<DemoTab>('scan')
  const [mint, setMint] = useState('So1111…1112')
  const [scanning, setScanning] = useState(false)
  const [score, setScore] = useState(78)

  function runDemoScan() {
    setScanning(true)
    window.setTimeout(() => {
      setScore(72 + Math.floor(Math.random() * 18))
      setScanning(false)
      setTab('evidence')
    }, 900)
  }

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(129,140,248,0.35)',
        background: '#0d1117',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 40px rgba(129,140,248,0.08)',
      }}
    >
      {/* Chrome bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '12px 16px',
          background: '#161b22',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }} aria-hidden>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            Dashboard Pro
          </span>
          <ForDevelopersBadge />
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: '#818cf8',
            padding: '2px 8px',
            borderRadius: 4,
            background: 'rgba(129,140,248,0.12)',
            border: '1px solid rgba(129,140,248,0.28)',
          }}
        >
          INTERACTIVE · SAMPLE
        </span>
      </div>

      {/* Scaled stage */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(129,140,248,0.12), transparent), #020617',
          padding: 'clamp(16px,3vw,28px)',
        }}
      >
        <div
          style={{
            transform: 'scale(0.92)',
            transformOrigin: 'top center',
            maxWidth: 720,
            margin: '0 auto',
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '0.16em', color: '#64748b', marginBottom: 6 }}>
            DASHBOARD PRO · API + EVIDENCE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.03em' }}>
              Dashboard Pro
            </h3>
            <ForDevelopersBadge size="md" />
          </div>

          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Dashboard Pro demo panels"
            style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}
          >
            {TABS.map((t) => {
              const on = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontFamily: "'IBM Plex Mono', monospace",
                    border: on ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.1)',
                    background: on ? 'rgba(129,140,248,0.18)' : 'rgba(255,255,255,0.03)',
                    color: on ? '#c4b5fd' : '#8b949e',
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {tab === 'scan' ? (
            <div
              style={{
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(2,6,23,0.75)',
                padding: 16,
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#64748b', marginBottom: 10 }}>
                LIVE SCAN · SAMPLE MINT
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <input
                  value={mint}
                  onChange={(e) => setMint(e.target.value)}
                  aria-label="Sample mint"
                  style={{
                    flex: '1 1 180px',
                    minWidth: 0,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(0,0,0,0.45)',
                    color: '#e2e8f0',
                    fontSize: 12,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                />
                <button
                  type="button"
                  onClick={runDemoScan}
                  disabled={scanning}
                  style={{
                    padding: '10px 16px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 8,
                    border: 'none',
                    cursor: scanning ? 'wait' : 'pointer',
                    background: 'linear-gradient(135deg,#818cf8,#6366f1)',
                    color: '#fff',
                    fontFamily: "'IBM Plex Mono', monospace",
                    opacity: scanning ? 0.7 : 1,
                  }}
                >
                  {scanning ? 'Scanning…' : 'Run scan'}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: '0.12em', color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
                    SECURITY SCORE
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 800,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: '#94a3b8',
                        padding: '1px 6px',
                        borderRadius: 3,
                        border: '1px solid rgba(148,163,184,0.45)',
                      }}
                    >
                      sample
                    </span>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#34d399', letterSpacing: '-0.04em' }}>
                    {score}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(52,211,153,0.12)',
                    color: '#34d399',
                    border: '1px solid rgba(52,211,153,0.3)',
                  }}
                >
                  SAFE · SAMPLE
                </span>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, maxWidth: 280, lineHeight: 1.5 }}>
                  Click Run scan — sample verdict only. Live API uses{' '}
                  <code style={{ color: '#6ee7b7', fontSize: 11 }}>POST /api/v1/scan</code>.
                </p>
              </div>
            </div>
          ) : null}

          {tab === 'evidence' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {EVIDENCE.map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <span style={{ fontSize: 11, color: '#64748b', fontFamily: "'IBM Plex Mono', monospace" }}>
                    {row.label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: row.tone,
                      textAlign: 'right',
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {row.detail}
                  </span>
                </div>
              ))}
              <p style={{ fontSize: 11, color: '#6e7681', margin: '8px 0 0' }}>
                Sample evidence rows — tagged for demo. Not live chain data.
              </p>
            </div>
          ) : null}

          {tab === 'api' ? (
            <div
              style={{
                borderRadius: 10,
                border: '1px solid rgba(56,189,248,0.25)',
                background: 'rgba(2,6,23,0.8)',
                padding: 16,
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#7dd3fc', marginBottom: 10 }}>
                CURL · INSTITUTIONAL SCAN
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: 11,
                  lineHeight: 1.65,
                  color: '#cbd5e1',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {`curl -X POST https://api.cryptocheckai.com/api/v1/scan \\
  -H "Authorization: Bearer $CCAI_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"mint":"So1111…1112"}'`}
              </pre>
              <p style={{ fontSize: 11, color: '#6e7681', margin: '12px 0 0', fontFamily: 'inherit' }}>
                Dashboard Pro surfaces the same explainable verdict your API returns.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: '#0a0e14',
        }}
      >
        <span style={{ fontSize: 11, color: '#6e7681' }}>
          Preview only · open the full product when ready
        </span>
        <a
          href="/pro/dashboard"
          style={{
            padding: '10px 16px',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 8,
            background: 'linear-gradient(135deg,#818cf8,#6366f1)',
            color: '#fff',
            textDecoration: 'none',
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          Open Dashboard Pro →
        </a>
      </div>
    </div>
  )
}
