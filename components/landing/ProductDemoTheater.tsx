'use client'

import { useCallback, useEffect, useState } from 'react'
import { ForDevelopersBadge } from '@/components/landing/ForDevelopersBadge'

export type DemoProductKey = 'dashboard' | 'launchlab' | 'dashboardPro' | 'app'

type DemoStep = {
  title: string
  body: string
  /** Short UI mock lines shown in the theater stage */
  stage: Array<{ label: string; value: string; tone?: 'ok' | 'warn' | 'bad' | 'muted' }>
}

type ProductDemo = {
  key: DemoProductKey
  title: string
  eyebrow: string
  href: string
  hrefLabel: string
  accent: string
  ink: string
  blurb: string
  iframeSrc: string
  steps: DemoStep[]
}

const PRODUCTS: ProductDemo[] = [
  {
    key: 'dashboard',
    title: 'Trading Dashboard',
    eyebrow: 'TRADE',
    href: '/dashboard',
    hrefLabel: 'Open Trading Dashboard',
    accent: '#20b2aa',
    ink: '#000',
    blurb: 'Scan → Swap → Snipe in one workspace. Watch how Alpha Feed feeds the Action Panel.',
    iframeSrc: '/dashboard',
    steps: [
      {
        title: '1 · Land on Overview',
        body: 'Alpha Feed lists public-channel opportunities. Nothing is traded until you pick Scan or Swap.',
        stage: [
          { label: 'Feed', value: 'Connecting… live channels', tone: 'muted' },
          { label: 'Tile', value: 'TOTAL OPPORTUNITIES — preview', tone: 'muted' },
          { label: 'Panel', value: 'Scan · Swap · Snipe · Launch', tone: 'ok' },
        ],
      },
      {
        title: '2 · Scan a mint',
        body: 'Paste a Solana mint. Neural V4 returns SAFE / CAUTION / DANGER before any swap can arm.',
        stage: [
          { label: 'Mint', value: 'So1111…1112 (sample)', tone: 'muted' },
          { label: 'Verdict', value: 'SAFE · score 82', tone: 'ok' },
          { label: 'Gate', value: 'Swap unlocked with fee line', tone: 'ok' },
        ],
      },
      {
        title: '3 · Risk-gated swap',
        body: 'You sign in your wallet. Platform fee + slippage show before confirm. DANGER stays behind friction.',
        stage: [
          { label: 'Route', value: 'Jupiter · simulated', tone: 'muted' },
          { label: 'Fee', value: 'Platform fee shown as line item', tone: 'warn' },
          { label: 'Sign', value: 'Non-custodial — your keys only', tone: 'ok' },
        ],
      },
    ],
  },
  {
    key: 'launchlab',
    title: 'LaunchLAB',
    eyebrow: 'CREATE',
    href: '/launchLab',
    hrefLabel: 'Open LaunchLAB',
    accent: '#f59e0b',
    ink: '#000',
    blurb: 'Create or discover on Raydium LaunchLab. Scanner gate runs before we build the launch tx.',
    iframeSrc: '/launchLab',
    steps: [
      {
        title: '1 · Discover',
        body: 'Browse bonding-curve style launches. Same risk language as the trading dashboard.',
        stage: [
          { label: 'Surface', value: 'Raydium LaunchLab path', tone: 'muted' },
          { label: 'List', value: 'Discover · Create tabs', tone: 'ok' },
          { label: 'Sample', value: 'Demo list — not live quotes', tone: 'warn' },
        ],
      },
      {
        title: '2 · Prepare launch',
        body: 'Name, symbol, metadata. Server refuses to build the tx when Neural gate fails.',
        stage: [
          { label: 'Gate', value: 'Neural V4 · must pass', tone: 'ok' },
          { label: 'Build', value: '/api/launch/prepare', tone: 'muted' },
          { label: 'Block', value: 'DANGER → no unsigned tx returned', tone: 'bad' },
        ],
      },
      {
        title: '3 · Confirm & sign',
        body: 'You confirm in-wallet. We never hold funds or keys.',
        stage: [
          { label: 'Confirm', value: '/api/launch/confirm', tone: 'muted' },
          { label: 'Wallet', value: 'User signature required', tone: 'ok' },
          { label: 'Custody', value: 'Non-custodial always', tone: 'ok' },
        ],
      },
    ],
  },
  {
    key: 'dashboardPro',
    title: 'Dashboard Pro',
    eyebrow: 'DEV',
    href: '/pro/dashboard',
    hrefLabel: 'Open Dashboard Pro',
    accent: '#818cf8',
    ink: '#fff',
    blurb: 'Explainable scans and API surface for developers — no signup required to preview.',
    iframeSrc: '/pro/dashboard',
    steps: [
      {
        title: '1 · Open Dashboard Pro',
        body: 'Developer-facing evidence path. See security score, verdict, and evidence without ops chrome.',
        stage: [
          { label: 'Title', value: 'Dashboard Pro', tone: 'ok' },
          { label: 'Badge', value: 'For Developers', tone: 'ok' },
          { label: 'Score', value: 'Sample · explainable verdict', tone: 'muted' },
        ],
      },
      {
        title: '2 · Read evidence',
        body: 'ReasoningObject: evidence lines, fingerprint match, cluster summary — not just a number.',
        stage: [
          { label: 'Evidence', value: 'liquidity · wallet · contract', tone: 'muted' },
          { label: 'Finger', value: 'Archetype match (when hit)', tone: 'warn' },
          { label: 'Cluster', value: 'Creator risk summary', tone: 'muted' },
        ],
      },
      {
        title: '3 · Go deeper',
        body: 'Need API keys / batch / ops tooling? Those live in Operator — not cluttering Trade.',
        stage: [
          { label: 'Pro', value: '/pro/dashboard', tone: 'ok' },
          { label: 'Ops', value: '/operator (gated)', tone: 'muted' },
          { label: 'Trade', value: '/dashboard stays clean', tone: 'ok' },
        ],
      },
    ],
  },
  {
    key: 'app',
    title: 'App',
    eyebrow: 'SCAN',
    href: '/app',
    hrefLabel: 'Open App',
    accent: '#00d4aa',
    ink: '#000',
    blurb: 'Consumer Neural Scanner. Paste a mint, get a verdict. Same /app product — unchanged.',
    iframeSrc: '/app',
    steps: [
      {
        title: '1 · Free credits',
        body: 'Google signup unlocks 10 Neural Scan credits. No card required.',
        stage: [
          { label: 'Credits', value: '10 free on signup', tone: 'ok' },
          { label: 'Card', value: 'Not required', tone: 'ok' },
          { label: 'Surface', value: '/app unchanged', tone: 'muted' },
        ],
      },
      {
        title: '2 · Paste & scan',
        body: 'Neural V4 scores risk vectors and returns SAFE / SCAM-style verdicts typically under 200ms.',
        stage: [
          { label: 'Input', value: 'Solana mint address', tone: 'muted' },
          { label: 'Engine', value: 'Neural Scan V4', tone: 'ok' },
          { label: 'Latency', value: 'Target P50 < 200ms cached path', tone: 'ok' },
        ],
      },
      {
        title: '3 · Upgrade when ready',
        body: 'Whale Mode / Full Access sits behind upgrade — explore the scan first on this landing.',
        stage: [
          { label: 'Whales', value: 'Pro gated elsewhere', tone: 'warn' },
          { label: 'Now', value: 'Watch demo → open /app', tone: 'ok' },
          { label: 'DYOR', value: 'Not financial advice', tone: 'muted' },
        ],
      },
    ],
  },
]

const toneColor = (tone?: DemoStep['stage'][0]['tone']) => {
  if (tone === 'ok') return '#34d399'
  if (tone === 'warn') return '#fbbf24'
  if (tone === 'bad') return '#f87171'
  return '#94a3b8'
}

type Props = {
  /** Optional external control (landing Explore cards) */
  activeKey?: DemoProductKey
  onActiveKeyChange?: (key: DemoProductKey) => void
}

/**
 * Landing Demo Theater — every product walkthrough + live iframe preview.
 * Sample/static stage data is tagged; iframes load real product surfaces.
 */
export function ProductDemoTheater({ activeKey, onActiveKeyChange }: Props) {
  const [internalKey, setInternalKey] = useState<DemoProductKey>(activeKey ?? 'dashboard')
  const key = activeKey ?? internalKey
  const product = PRODUCTS.find((p) => p.key === key) ?? PRODUCTS[0]
  const [stepIdx, setStepIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [liveInteract, setLiveInteract] = useState(false)

  useEffect(() => {
    if (activeKey) setInternalKey(activeKey)
  }, [activeKey])

  useEffect(() => {
    setStepIdx(0)
    setPlaying(true)
    setLiveInteract(false)
  }, [key])

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setStepIdx((i) => (i + 1) % product.steps.length)
    }, 3800)
    return () => window.clearInterval(id)
  }, [playing, product.steps.length, key])

  const select = useCallback(
    (next: DemoProductKey) => {
      setInternalKey(next)
      onActiveKeyChange?.(next)
    },
    [onActiveKeyChange]
  )

  const step = product.steps[stepIdx] ?? product.steps[0]

  return (
    <div id="hub-demo">
      {/* Product tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 16,
        }}
        role="tablist"
        aria-label="Product demos"
      >
        {PRODUCTS.map((p) => {
          const on = p.key === key
          return (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(p.key)}
              style={{
                padding: '10px 14px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                borderRadius: 8,
                cursor: 'pointer',
                fontFamily: "'IBM Plex Mono', monospace",
                border: on ? `1px solid ${p.accent}` : '1px solid rgba(255,255,255,0.1)',
                background: on ? `${p.accent}22` : 'rgba(255,255,255,0.02)',
                color: on ? p.accent : '#8b949e',
              }}
            >
              {p.title}
            </button>
          )
        })}
      </div>

      <div
        style={{
          background: '#0d1117',
          border: `1px solid ${product.accent}40`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: `0 20px 60px rgba(0,0,0,0.45),0 0 40px ${product.accent}14`,
        }}
      >
        {/* Title bar */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
              {product.title} · Watch demo
            </span>
            {product.key === 'dashboardPro' ? <ForDevelopersBadge /> : null}
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: product.accent,
                padding: '2px 8px',
                borderRadius: 4,
                background: `${product.accent}18`,
                border: `1px solid ${product.accent}33`,
              }}
            >
              {playing ? '● AUTO' : '❚❚ PAUSED'}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              onClick={() => setPlaying((v) => !v)}
              style={{
                padding: '7px 12px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent',
                color: '#e2e8f0',
                cursor: 'pointer',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => setStepIdx((i) => (i + 1) % product.steps.length)}
              style={{
                padding: '7px 12px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 6,
                border: `1px solid ${product.accent}55`,
                background: `${product.accent}15`,
                color: product.accent,
                cursor: 'pointer',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              Next step →
            </button>
          </div>
        </div>

        {/* Walkthrough + stage */}
        <div
          className="lp-hero-grid"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.15fr)' }}
        >
          <div style={{ padding: 'clamp(18px,3vw,28px)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: product.accent, marginBottom: 8 }}>
              {product.eyebrow} · DEMO {stepIdx + 1}/{product.steps.length}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              {step.title}
            </h3>
            <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.7, margin: '0 0 16px' }}>{step.body}</p>
            <p style={{ fontSize: 12, color: '#6e7681', lineHeight: 1.6, margin: '0 0 18px' }}>{product.blurb}</p>

            {/* Step dots */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }} aria-hidden>
              {product.steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setStepIdx(i)
                    setPlaying(false)
                  }}
                  style={{
                    width: i === stepIdx ? 28 : 8,
                    height: 8,
                    borderRadius: 99,
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    background: i === stepIdx ? product.accent : 'rgba(255,255,255,0.15)',
                    transition: 'width 0.25s, background 0.25s',
                  }}
                  aria-label={`Step ${i + 1}`}
                />
              ))}
            </div>

            <a
              href={product.href}
              style={{
                display: 'inline-flex',
                padding: '12px 20px',
                fontSize: 13,
                fontWeight: 700,
                background: `linear-gradient(135deg,${product.accent},${product.accent}cc)`,
                color: product.ink,
                borderRadius: 8,
                textDecoration: 'none',
              }}
            >
              {product.hrefLabel} →
            </a>
          </div>

          <div style={{ padding: 'clamp(16px,2.5vw,24px)', background: 'rgba(0,0,0,0.35)', minHeight: 240 }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: '0.12em',
                color: '#64748b',
                marginBottom: 12,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span>WALKTHROUGH STAGE</span>
              <span
                style={{
                  color: '#fbbf24',
                  border: '1px solid rgba(251,191,36,0.35)',
                  borderRadius: 4,
                  padding: '1px 6px',
                }}
              >
                sample
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {step.stage.map((row) => (
                <div
                  key={row.label + row.value}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    animation: 'fadeInUp 0.45s ease-out',
                  }}
                >
                  <span style={{ fontSize: 11, color: '#64748b', fontFamily: "'IBM Plex Mono', monospace" }}>
                    {row.label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: toneColor(row.tone),
                      textAlign: 'right',
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live product preview */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              padding: '10px 16px',
              background: '#0a0e14',
            }}
          >
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>Live product preview</span>
              <span style={{ fontSize: 11, color: '#6e7681', marginLeft: 8 }}>{product.iframeSrc}</span>
            </div>
            <button
              type="button"
              onClick={() => setLiveInteract((v) => !v)}
              style={{
                padding: '7px 12px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 6,
                border: liveInteract ? `1px solid ${product.accent}` : '1px solid rgba(255,255,255,0.12)',
                background: liveInteract ? `${product.accent}22` : 'transparent',
                color: liveInteract ? product.accent : '#8b949e',
                cursor: 'pointer',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {liveInteract ? 'Click inside: ON' : 'Enable click inside'}
            </button>
          </div>
          <div style={{ height: 'clamp(280px,48vw,480px)', position: 'relative', overflow: 'hidden', background: '#000' }}>
            <iframe
              key={product.iframeSrc}
              src={product.iframeSrc}
              title={`${product.title} live preview`}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                pointerEvents: liveInteract ? 'auto' : 'none',
              }}
              loading="lazy"
            />
            {!liveInteract ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.88) 100%)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 28,
                  gap: 10,
                  flexWrap: 'wrap',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    pointerEvents: 'auto',
                    padding: '10px 14px',
                    fontSize: 11,
                    color: '#8b949e',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.7)',
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  Watch above · or enable click to try inside
                </span>
                <a
                  href={product.href}
                  style={{
                    pointerEvents: 'auto',
                    padding: '12px 20px',
                    fontSize: 13,
                    fontWeight: 700,
                    background: `linear-gradient(135deg,${product.accent},${product.accent}cc)`,
                    color: product.ink,
                    borderRadius: 8,
                    textDecoration: 'none',
                  }}
                >
                  Go to {product.title} →
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export const LANDING_DEMO_PRODUCTS = PRODUCTS
