'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import CopilotDecisionPanel from '@/components/trading-os/CopilotDecisionPanel'
import TradingOsStreamPanel from '@/components/trading-os/TradingOsStreamPanel'

export interface DeepProps {
  isPro: boolean
  hasPremiumAccess?: boolean
  /** Synced from Scanner / chart — drives live intel when set. */
  mint?: string
  /** PRO MAX DEEP / ELITE band — enables `/api/promax/deep-panel` live chain fusion + copilot. */
  deepLiveIntel?: boolean
  onUpgrade: () => void
}

type ForensicEntry = { tag: string; color: string; msg: string; priority?: 'high' | 'normal' }

type DeepPanelPayload = {
  mint: string
  symbol: string
  neuralScore: number
  iei: number
  isSplMintRenounced: boolean
  isSplFullyRenounced: boolean
  splMintAuthority: string | null
  splFreezeAuthority: string | null
  metadataUpdateAuthority: string | null
  securityPulse: string
  securityComplexity: number
  clusterRiskPct: number
  holdersAnalyzed: number
  sharedFundingMax: number
  devLinkedHolders: number
  top1Pct: number
  liquidityUsd: number
  pairAgeMin: number | null
  timeToImpact: string
  acutePoolWindowEndMs: number | null
  lpForensicLines: ForensicEntry[]
  dexUrl: string
  scannedAt: string
}

const DEMO_LOGS: ForensicEntry[] = [
  {
    tag: 'DEEP_LEARNING',
    color: '#d4af37',
    msg: 'Demo mode — connect PRO MAX DEEP / ELITE + mint for live LP + cluster fusion.',
  },
  { tag: 'LP_MONITOR', color: '#20b2aa', msg: 'Static preview only.' },
]

function NeuralGauge({ score }: { score: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const s = Math.max(0, Math.min(100, score))
  const offset = circ - (s / 100) * circ
  const color = s >= 70 ? '#00ff88' : s >= 45 ? '#d4af37' : '#ff4444'
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x="60" y="56" textAnchor="middle" fill={color} fontSize="22" fontWeight="700" fontFamily="monospace">
        {s}
      </text>
      <text x="60" y="72" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8" fontFamily="monospace">
        Neural
      </text>
    </svg>
  )
}

function ForensicLogPanel({ entries }: { entries: ForensicEntry[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo(0, ref.current.scrollHeight)
  }, [entries])
  return (
    <div
      style={{
        background: '#080808',
        border: '1px solid rgba(212,175,55,0.1)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 0 40px rgba(212,175,55,0.03)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: '#0c0c0c',
          borderBottom: '1px solid rgba(212,175,55,0.08)',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
        </div>
        <span
          style={{
            fontSize: 9,
            color: '#484f58',
            letterSpacing: '0.08em',
            fontFamily: "'IBM Plex Mono',monospace",
          }}
        >
          NEURAL_ENGINE_v4.0 — DEEP FORENSIC MODE
        </span>
        <span
          style={{
            fontSize: 7,
            fontWeight: 700,
            color: '#d4af37',
            padding: '2px 8px',
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.15)',
            borderRadius: 3,
            animation: 'dpulse 2s infinite',
          }}
        >
          ● LIVE
        </span>
      </div>
      <div
        ref={ref}
        style={{
          height: 320,
          overflowY: 'auto',
          padding: '12px 16px',
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: 11,
          lineHeight: 1.9,
          scrollbarWidth: 'none',
        }}
      >
        {entries.map((l, i) => (
          <div
            key={i}
            style={{
              opacity: i === entries.length - 1 ? 1 : 0.65,
              animation: i === entries.length - 1 ? 'dfadeIn 0.3s ease' : 'none',
              marginBottom: 2,
            }}
          >
            <span style={{ color: '#303030', marginRight: 8 }}>{new Date().toTimeString().slice(0, 8)}</span>
            <span
              style={{
                color: l.color,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 2,
                background: l.color + '11',
                marginRight: 8,
                fontSize: 9,
                letterSpacing: '0.06em',
              }}
            >
              {l.tag}
            </span>
            <span style={{ color: l.tag === 'VERDICT' ? l.color : '#8b949e' }}>{l.msg}</span>
          </div>
        ))}
        <span style={{ color: '#d4af37', animation: 'dblink 1s infinite' }}>█</span>
      </div>
    </div>
  )
}

export default function ProMaxDeepDashboard({
  isPro,
  hasPremiumAccess,
  mint: mintProp = '',
  deepLiveIntel = false,
  onUpgrade,
}: DeepProps) {
  const [mt, sM] = useState(false)
  const [localMint, setLocalMint] = useState(mintProp.trim())
  useEffect(() => sM(true), [])
  useEffect(() => {
    setLocalMint(mintProp.trim())
  }, [mintProp])

  const unlocked = isPro || !!hasPremiumAccess
  const activeMint = localMint.trim()
  const liveOn = unlocked && deepLiveIntel && activeMint.length >= 32

  const [panel, setPanel] = useState<DeepPanelPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const fetchPanel = useCallback(async () => {
    if (!liveOn) return
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/promax/deep-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: activeMint }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(j?.error || `HTTP ${res.status}`)
        setPanel(null)
        return
      }
      setPanel(j as DeepPanelPayload)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fetch failed')
      setPanel(null)
    } finally {
      setLoading(false)
    }
  }, [liveOn, activeMint])

  useEffect(() => {
    void fetchPanel()
  }, [fetchPanel])

  useEffect(() => {
    if (!liveOn) return
    const t = setInterval(() => void fetchPanel(), 22_000)
    return () => clearInterval(t)
  }, [liveOn, fetchPanel])

  const forensicEntries: ForensicEntry[] = liveOn
    ? panel
      ? [
          ...panel.lpForensicLines,
          {
            tag: 'HEURISTIC',
            color: '#d4af37',
            msg: `Security pulse ${panel.securityComplexity}/100 · IEI ${panel.iei} · Top-1 ${panel.top1Pct.toFixed(1)}%`,
          },
          {
            tag: 'SYS',
            color: '#6e7681',
            msg: `Polled ${new Date(panel.scannedAt).toLocaleTimeString()} · mint ${panel.mint.slice(0, 4)}…${panel.mint.slice(-4)}`,
          },
        ]
      : [
          {
            tag: 'SYS',
            color: err ? '#ff4444' : '#d4af37',
            msg: loading ? 'Polling on-chain LP + holder graph…' : err ? String(err) : 'Preparing live forensic batch…',
          },
        ]
    : DEMO_LOGS

  const clusterStat = liveOn && panel ? `${panel.clusterRiskPct}%` : '—'
  const clusterSub = liveOn && panel ? 'Cluster risk (heuristic)' : 'Live tier required'

  const neuralStat = liveOn && panel ? String(panel.neuralScore) : '—'
  const neuralSub = liveOn && panel ? 'Token-exit-intel gauge' : 'Live tier required'

  const lpStat = liveOn && panel ? panel.timeToImpact : '—'
  const lpSub = liveOn && panel ? 'LP + pool age fusion' : 'Live tier required'

  const feats = [
    {
      icon: '◈',
      title: 'Cluster Mapping',
      sub: 'SYBIL DETECTION',
      desc: 'Top holder token accounts (RPC max 20) resolved to owners; funding fee-payer overlap + dev-wallet linkage heuristics.',
      stat: clusterStat,
      statL: liveOn && panel ? `${panel.holdersAnalyzed} wallets · dev-linked ${panel.devLinkedHolders}` : clusterSub,
    },
    {
      icon: '◉',
      title: 'Heuristic Risk Scoring',
      sub: 'NEURAL MODEL',
      desc: 'Neural score from mint/freeze authorities, metadata mutability, liquidity, flow, and pool age — same family as token-exit-intel.',
      stat: neuralStat,
      statL: liveOn && panel ? panel.securityPulse.slice(0, 72) + (panel.securityPulse.length > 72 ? '…' : '') : neuralSub,
    },
    {
      icon: '◎',
      title: 'Liquidity Forensics',
      sub: 'LP EXIT PREDICTION',
      desc: 'Helius pair transactions scanned for burn/transfer-class signals; time-to-impact from pool age + activity.',
      stat: lpStat,
      statL: liveOn && panel ? `Liq $${Math.round(panel.liquidityUsd).toLocaleString()}` : lpSub,
    },
  ]

  const comp = [
    { feat: 'Neural Scan Engine', basic: 'Pattern matching', pro: 'Deep Learning + GNN' },
    { feat: 'Scan Limit', basic: '10 credits', pro: '∞ Unlimited' },
    { feat: 'Risk Model', basic: 'Rule-based flags', pro: 'Heuristic + exit-intel facts' },
    { feat: 'Cluster Mapping', basic: '—', pro: 'Holder graph heuristics' },
    { feat: 'Liquidity Forensics', basic: 'Basic LP check', pro: 'Pair tx LP signals' },
    { feat: 'Whale Feed', basic: 'Standard', pro: 'Priority (< 200ms)' },
    { feat: 'Platform Fee', basic: '0.50% per trade', pro: '0.50% · shown before confirm' },
    { feat: 'Forensic Audit Log', basic: '—', pro: 'Full deep scan logs' },
    { feat: 'Contract Decompiler', basic: '—', pro: 'Bytecode analysis' },
  ]

  if (!mt) return null

  return (
    <div style={{ padding: 'clamp(16px,3vw,32px)', fontFamily: "'IBM Plex Mono','JetBrains Mono',monospace", maxWidth: 900, margin: '0 auto' }}>
      {/* ═══ HERO ═══ */}
      <div style={{ textAlign: 'center', marginBottom: 48, paddingTop: 12 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            borderRadius: 20,
            background: 'rgba(212,175,55,0.06)',
            border: '1px solid rgba(212,175,55,0.15)',
            marginBottom: 20,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#d4af37',
              boxShadow: '0 0 8px #d4af37',
              animation: 'dpulse 2s infinite',
            }}
          />
          <span style={{ fontSize: 10, color: '#d4af37', fontWeight: 700, letterSpacing: '0.1em' }}>
            PRO MAX NEURAL ENGINE v4.0
          </span>
        </div>
        <h1
          style={{
            fontSize: 'clamp(24px,4vw,36px)',
            fontWeight: 800,
            color: '#fff',
            margin: '0 0 12px',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
          }}
        >
          Beyond Pattern Matching.{' '}
          <span
            style={{
              background: 'linear-gradient(135deg,#d4af37,#FFD700)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Deep Forensic Intelligence.
          </span>
        </h1>
        <p style={{ fontSize: 'clamp(12px,1.4vw,14px)', color: '#6e7681', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 16px' }}>
          {liveOn
            ? 'Live Solana + Helius + DexScreener fusion — PRO MAX DEEP / ELITE command tier.'
            : unlocked && !deepLiveIntel
              ? 'Upgrade to PRO MAX DEEP or PRO MAX ELITE to unlock live cluster, neural, LP fusion, and the AI copilot for any mint.'
              : 'Graph Neural Networks and Deep Contract Decompilation identify fraud clusters across the Solana ecosystem.'}
        </p>

        {unlocked && (
          <div style={{ maxWidth: 420, margin: '0 auto 20px', textAlign: 'left' }}>
            <div style={{ fontSize: 9, color: '#6e7681', marginBottom: 6, letterSpacing: '0.08em' }}>MINT ADDRESS</div>
            <input
              value={localMint}
              onChange={(e) => setLocalMint(e.target.value)}
              placeholder="Paste Solana mint (syncs from Scanner when set)…"
              spellCheck={false}
              style={{
                width: '100%',
                background: 'rgba(212,175,55,0.06)',
                border: '1px solid rgba(212,175,55,0.2)',
                borderRadius: 8,
                padding: '10px 12px',
                color: '#e6edf3',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            />
            {liveOn && (
              <div style={{ marginTop: 8, fontSize: 10, color: loading ? '#d4af37' : err ? '#ff4444' : '#20b2aa' }}>
                {loading ? 'Refreshing on-chain intel…' : err ? `Error: ${err}` : panel ? `Live · ${panel.symbol}` : ''}
              </div>
            )}
            <CopilotDecisionPanel mint={activeMint} enabled={liveOn} />
            <TradingOsStreamPanel enabled={unlocked} />
          </div>
        )}

        {!unlocked && (
          <>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 24px',
                borderRadius: 10,
                background: 'rgba(212,175,55,0.04)',
                border: '1px solid rgba(212,175,55,0.12)',
                boxShadow: '0 0 30px rgba(212,175,55,0.04)',
                marginBottom: 24,
              }}
            >
              <span style={{ fontSize: 30, fontWeight: 900, color: '#d4af37' }}>$30</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 11, color: '#d4af37', fontWeight: 700 }}>/month</div>
                <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: '0.06em' }}>UNLIMITED FORENSIC AUDITS</div>
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={onUpgrade}
                style={{
                  padding: '14px 32px',
                  fontSize: 13,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg,#d4af37,#FFD700)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#000',
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Mono',monospace",
                  boxShadow: '0 0 25px rgba(212,175,55,0.2)',
                  letterSpacing: '0.03em',
                  transition: 'transform 0.2s',
                }}
              >
                Upgrade to Pro Max Deep
              </button>
            </div>
          </>
        )}
      </div>

      {unlocked && (
        <>
          {liveOn && panel && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
                marginBottom: 36,
                padding: '16px',
                background: '#080808',
                border: '1px solid rgba(212,175,55,0.1)',
                borderRadius: 12,
              }}
            >
              <NeuralGauge score={panel.neuralScore} />
              <div style={{ flex: '1 1 220px', textAlign: 'left' }}>
                <div style={{ fontSize: 10, color: '#d4af37', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 8 }}>
                  NEURAL SCORE · EXIT-INTEL
                </div>
                <p style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.6, margin: 0 }}>
                  {panel.securityPulse}
                </p>
                <div style={{ marginTop: 10, fontSize: 10, color: '#484f58' }}>
                  Mint renounced: {panel.isSplMintRenounced ? 'yes' : 'no'} · Freeze:{' '}
                  {panel.splFreezeAuthority ? 'active' : 'none'} · Metadata auth:{' '}
                  {panel.metadataUpdateAuthority ? panel.metadataUpdateAuthority.slice(0, 6) + '…' : 'none'}
                </div>
                {panel.dexUrl ? (
                  <a href={panel.dexUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#d4af37', marginTop: 8, display: 'inline-block' }}>
                    Open pair on DexScreener →
                  </a>
                ) : null}
              </div>
            </div>
          )}

          {/* ═══ FEATURE GRID ═══ */}
          <div style={{ marginBottom: 48 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.2em',
                color: '#d4af37',
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              THE DEEP LEARNING EDGE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16 }}>
              {feats.map((f, i) => (
                <div
                  key={i}
                  style={{
                    background: '#080808',
                    border: '1px solid rgba(212,175,55,0.08)',
                    borderRadius: 10,
                    padding: 'clamp(16px,2vw,24px)',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'border-color 0.3s',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: -15,
                      right: -5,
                      fontSize: 60,
                      fontWeight: 900,
                      color: 'rgba(212,175,55,0.03)',
                      lineHeight: 1,
                    }}
                  >
                    0{i + 1}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#d4af37', marginBottom: 10 }}>
                    {f.sub}
                  </div>
                  <div style={{ fontSize: 20, color: '#d4af37', marginBottom: 4, fontWeight: 300 }}>{f.icon}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '6px 0 8px', letterSpacing: '-0.01em' }}>{f.title}</h3>
                  <p style={{ fontSize: 12, color: '#6e7681', lineHeight: 1.6, margin: '0 0 14px' }}>{f.desc}</p>
                  <div
                    style={{
                      borderTop: '1px solid rgba(212,175,55,0.06)',
                      paddingTop: 10,
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#d4af37' }}>{f.stat}</span>
                    <span style={{ fontSize: 9, color: '#484f58', letterSpacing: '0.06em' }}>{f.statL}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ LIVE FORENSIC LOG ═══ */}
          <div style={{ marginBottom: 48 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.2em',
                color: '#20b2aa',
                marginBottom: 14,
                textAlign: 'center',
              }}
            >
              LIVE FORENSIC LOG
            </div>
            <ForensicLogPanel entries={forensicEntries} />
          </div>
        </>
      )}

      {/* ═══ COMPARISON TABLE ═══ */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: '#d4af37', marginBottom: 14, textAlign: 'center' }}>
          PLAN COMPARISON
        </div>
        <div style={{ background: '#080808', border: '1px solid rgba(212,175,55,0.08)', borderRadius: 10, overflowX: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 1fr 1fr',
              background: '#0c0c0c',
              borderBottom: '1px solid rgba(212,175,55,0.06)',
              minWidth: 520,
            }}
          >
            <div style={{ padding: '12px 16px', fontSize: 8, fontWeight: 700, color: '#484f58', letterSpacing: '0.12em' }}>FEATURE</div>
            <div style={{ padding: '12px 16px', fontSize: 8, fontWeight: 700, color: '#6e7681', letterSpacing: '0.12em', textAlign: 'center' }}>
              BASIC SCAN
              <br />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#8b949e' }}>Free</span>
            </div>
            <div style={{ padding: '12px 16px', fontSize: 8, fontWeight: 700, color: '#d4af37', letterSpacing: '0.12em', textAlign: 'center' }}>
              PRO MAX DEEP
              <br />
              <span style={{ fontSize: 12, fontWeight: 800 }}>$30/mo</span>
            </div>
          </div>
          {comp.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.3fr 1fr 1fr',
                borderBottom: i < comp.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                transition: 'background 0.2s',
                minWidth: 520,
              }}
            >
              <div style={{ padding: '10px 16px', fontSize: 'clamp(10px,2.8vw,11px)', lineHeight: 1.4, color: '#c9d1d9', fontWeight: 600 }}>
                {r.feat}
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  fontSize: 'clamp(10px,2.8vw,11px)',
                  lineHeight: 1.4,
                  color: r.basic === '—' ? '#202020' : '#6e7681',
                  textAlign: 'center',
                }}
              >
                {r.basic}
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  fontSize: 'clamp(10px,2.8vw,11px)',
                  lineHeight: 1.4,
                  color: r.pro.includes('∞') || r.pro.includes('0%') ? '#d4af37' : '#20b2aa',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                {r.pro}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!unlocked && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <button
            type="button"
            onClick={onUpgrade}
            style={{
              padding: '16px 40px',
              fontSize: 14,
              fontWeight: 700,
              background: 'linear-gradient(135deg,#d4af37,#FFD700)',
              border: 'none',
              borderRadius: 8,
              color: '#000',
              cursor: 'pointer',
              fontFamily: "'IBM Plex Mono',monospace",
              boxShadow: '0 0 30px rgba(212,175,55,0.2)',
              letterSpacing: '0.03em',
            }}
          >
            Upgrade to Pro Max Deep — $30/mo
          </button>
          <div style={{ fontSize: 10, color: '#303030', marginTop: 10, letterSpacing: '0.04em' }}>
            Cancel anytime · 0% performance fees · Unlimited forensic scans
          </div>
        </div>
      )}

      <style>{`
        @keyframes dpulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes dfadeIn{from{opacity:0}to{opacity:1}}
        @keyframes dblink{0%,100%{opacity:1}50%{opacity:0}}
      `}</style>
    </div>
  )
}
