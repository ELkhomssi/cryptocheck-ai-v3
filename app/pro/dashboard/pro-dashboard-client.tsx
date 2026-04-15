'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Home, LayoutDashboard } from 'lucide-react'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { useSolana } from '@/components/SolanaProvider'
import type { ProDashboardSession } from '@/lib/types/pro-dashboard'
import type { ReasoningObject } from '@/lib/services/scanner-engine'
import { PulseFeed } from '@/components/pro/PulseFeed'

type Props = {
  session: ProDashboardSession
  demoReasoning: ReasoningObject
}

function verdictColor(v: ReasoningObject['verdict']): string {
  if (v === 'CRITICAL_RISK') return '#f87171'
  if (v === 'HIGH_RISK') return '#fb923c'
  if (v === 'CAUTION') return '#fbbf24'
  return '#34d399'
}

export function ProDashboardClient({ session, demoReasoning }: Props) {
  const [reasoning, setReasoning] = useState<ReasoningObject>(demoReasoning)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [dlBusy, setDlBusy] = useState<'pdf' | 'json' | null>(null)
  const { connect, disconnect, isConnected, shortAddr, isConnecting } = useSolana()

  const canUseDeepApi = session.hasDeepAccess

  const headline = useMemo(() => {
    if (!session.userId) return 'Institutional Terminal — preview mode'
    if (!session.hasDeepAccess) return 'Institutional Terminal — upgrade for live reasoning API'
    return 'Institutional Terminal'
  }, [session])

  const orderedEvidence = useMemo(() => {
    const sim = reasoning.evidence.filter((l) => l.id === 'ev_live_simulation')
    const rest = reasoning.evidence.filter((l) => l.id !== 'ev_live_simulation')
    return [...sim, ...rest]
  }, [reasoning.evidence])

  const demoMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

  async function runLiveReasoning() {
    if (!canUseDeepApi) return
    setLoading(true)
    setApiError(null)
    try {
      const r = await fetch('/api/v1/scan/reasoning', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint: demoMint,
          liquidityUsd: 8_500_000,
          topHolderPct: 12,
          pairAgeMinutes: 10080,
          mintAuthorityActive: false,
          creatorScamLinkedFundingCount: 0,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setReasoning(j.reasoning as ReasoningObject)
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  async function downloadReport(format: 'pdf' | 'json') {
    if (!canUseDeepApi) return
    setDlBusy(format)
    try {
      const r = await fetch('/api/v1/audit/report', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          mint: demoMint,
          tokenName: 'Demo / USDC',
          reasoning,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error || `HTTP ${r.status}`)
      }
      const blob = await r.blob()
      const ext = format === 'pdf' ? 'pdf' : 'json'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cryptocheck-audit-${demoMint.slice(0, 8)}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDlBusy(null)
    }
  }

  function downloadReasoningJsonLocal() {
    const blob = new Blob([JSON.stringify(reasoning, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cryptocheck-reasoning-${demoMint.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes cc-pulse-glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.35); }
          50% { opacity: 0.75; box-shadow: 0 0 0 8px rgba(52, 211, 153, 0); }
        }
        .cc-pulse-dot { animation: cc-pulse-glow 2.2s ease-in-out infinite; }
        @keyframes cc-terminal-pulse {
          0%, 100% { border-color: rgba(56, 189, 248, 0.18); box-shadow: inset 0 0 0 0 rgba(56,189,248,0); }
          50% { border-color: rgba(56, 189, 248, 0.42); box-shadow: inset 0 0 24px rgba(56,189,248,0.06); }
        }
        .cc-terminal-live { animation: cc-terminal-pulse 2.8s ease-in-out infinite; }
      `}} />

      <div
        className={GeistSans.className}
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: 'clamp(20px,4vw,40px) clamp(14px,4vw,40px) clamp(48px,8vw,88px)',
          fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <nav
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              color: '#f4f4f5',
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: '-0.02em',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'linear-gradient(135deg,#6366f1,#22d3ee)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 800,
                color: '#020617',
              }}
            >
              CC
            </span>
            CryptoCheck<span style={{ color: '#a5b4fc' }}>AI</span>
          </Link>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                padding: '8px 12px',
                borderRadius: 8,
                border: '0.5px solid rgba(255,255,255,0.12)',
                color: '#a1a1aa',
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <Home size={16} strokeWidth={2} aria-hidden />
              Home
            </Link>
            <Link
              href="/app"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                padding: '8px 12px',
                borderRadius: 8,
                border: '0.5px solid rgba(255,255,255,0.12)',
                color: '#a1a1aa',
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <LayoutDashboard size={16} strokeWidth={2} aria-hidden />
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => (isConnected ? disconnect() : void connect())}
              disabled={isConnecting}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: 8,
                border: '0.5px solid rgba(52, 211, 153, 0.35)',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#6ee7b7',
                cursor: 'pointer',
              }}
            >
              {isConnecting ? 'Connecting…' : isConnected ? `✓ ${shortAddr}` : 'Connect Wallet'}
            </button>
          </div>
        </nav>

        <header style={{ marginBottom: 'clamp(20px,4vw,36px)' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#6b7280', marginBottom: 10 }}>
            CRYPTOCHECK AI · PRO
          </div>
          <h1
            style={{
              fontSize: 'clamp(20px,4vw,28px)',
              fontWeight: 600,
              margin: 0,
              letterSpacing: '-0.03em',
            }}
          >
            {headline}
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 'clamp(13px,2.5vw,14px)', marginTop: 10, maxWidth: 560 }}>
            Raw evidence, institutional grade, dynamic simulation — same contract as{' '}
            <code style={{ fontSize: 12, color: '#a5b4fc' }}>/api/v1/scan/reasoning</code> (Pro+).
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 20,
              alignItems: 'center',
            }}
          >
            <Link
              href="/app"
              style={{
                fontSize: 12,
                padding: '8px 14px',
                borderRadius: 8,
                border: '0.5px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                color: '#e5e7eb',
                textDecoration: 'none',
              }}
            >
              Consumer app
            </Link>
            {!session.userId && (
              <Link
                href="/landing"
                style={{
                  fontSize: 12,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '0.5px solid rgba(129, 140, 248, 0.35)',
                  color: '#a5b4fc',
                  textDecoration: 'none',
                }}
              >
                Sign in
              </Link>
            )}
            {session.userId && !session.hasDeepAccess && (
              <span style={{ fontSize: 12, color: '#fbbf24' }}>
                Deep analysis API requires Pro or Institutional.
              </span>
            )}
          </div>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr)',
            gap: 'clamp(16px,3vw,24px)',
          }}
        >
          <PulseFeed />

          <section
            style={{
              borderRadius: 14,
              border: '0.5px solid rgba(255,255,255,0.08)',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
              backdropFilter: 'blur(18px)',
              padding: 'clamp(16px,3vw,22px) clamp(14px,3vw,22px) clamp(18px,3vw,24px)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#6b7280' }}>
                  AI REASONING · TERMINAL
                </div>
                <div style={{ fontSize: 'clamp(12px,2.5vw,13px)', color: '#d1d5db', marginTop: 6, lineHeight: 1.5 }}>
                  Grade{' '}
                  <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{reasoning.institutionalGrade}</span> · Verdict{' '}
                  <span style={{ color: verdictColor(reasoning.verdict), fontWeight: 600 }}>{reasoning.verdict}</span>{' '}
                  · Score <span style={{ color: '#34d399' }}>{reasoning.aggregateScore}</span> / 100 · Confidence{' '}
                  {reasoning.confidenceScore}%
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={!canUseDeepApi || loading}
                  onClick={() => void runLiveReasoning()}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '0.5px solid rgba(52, 211, 153, 0.35)',
                    background: canUseDeepApi ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.04)',
                    color: canUseDeepApi ? '#6ee7b7' : '#6b7280',
                    cursor: canUseDeepApi ? 'pointer' : 'not-allowed',
                  }}
                >
                  {loading ? 'Running…' : 'Run live reasoning'}
                </button>
                <button
                  type="button"
                  disabled={!canUseDeepApi || dlBusy !== null}
                  onClick={() => void downloadReport('pdf')}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '0.5px solid rgba(129, 140, 248, 0.35)',
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: '#a5b4fc',
                    cursor: canUseDeepApi ? 'pointer' : 'not-allowed',
                  }}
                >
                  {dlBusy === 'pdf' ? '…' : 'Download PDF Audit'}
                </button>
                <button
                  type="button"
                  disabled={!canUseDeepApi || dlBusy !== null}
                  onClick={() => void downloadReport('json')}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '0.5px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#e5e7eb',
                    cursor: canUseDeepApi ? 'pointer' : 'not-allowed',
                  }}
                >
                  {dlBusy === 'json' ? '…' : 'Export JSON (API)'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadReasoningJsonLocal()}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '0.5px solid rgba(148, 163, 184, 0.25)',
                    background: 'rgba(148, 163, 184, 0.08)',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  Download JSON (local)
                </button>
              </div>
            </div>

            {apiError && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#f87171' }}>{apiError}</div>
            )}

            {reasoning.dynamicSimulation && (
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '0.5px solid rgba(248, 113, 113, 0.2)',
                  background: 'rgba(248, 113, 113, 0.06)',
                  fontSize: 12,
                  color: '#fecaca',
                }}
              >
                <strong style={{ color: '#fca5a5' }}>Dynamic simulation</strong> — {reasoning.dynamicSimulation.summary}
                {reasoning.dynamicSimulation.realizedTaxOrSlippagePct != null && (
                  <span> · Tax/slippage est. {reasoning.dynamicSimulation.realizedTaxOrSlippagePct.toFixed(2)}%</span>
                )}
              </div>
            )}

            <div
              className={`${GeistMono.className} cc-terminal-live`}
              style={{
                marginTop: 18,
                padding: 'clamp(12px,3vw,16px) clamp(12px,3vw,18px)',
                borderRadius: 10,
                border: '0.5px solid rgba(56, 189, 248, 0.25)',
                background: 'rgba(0,0,0,0.35)',
                fontSize: 'clamp(11px,2.4vw,12px)',
                lineHeight: 1.65,
                color: '#cbd5e1',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div style={{ color: '#64748b', marginBottom: 8 }}>{'// RAW EVIDENCE (Live Simulation first)'}</div>
              {orderedEvidence.map((line) => (
                <div key={line.id} style={{ marginBottom: 10 }}>
                  <span style={{ color: '#818cf8' }}>[{line.category}]</span>{' '}
                  <span style={{ color: '#f1f5f9' }}>{line.label}</span>
                  {line.riskContribution > 0 && (
                    <span style={{ color: '#fb923c' }}> · risk −{line.riskContribution.toFixed(0)}</span>
                  )}
                  <div style={{ color: '#94a3b8', marginTop: 2 }}>{line.detail}</div>
                </div>
              ))}
              <div style={{ marginTop: 14, color: '#64748b' }}>{'// FLAGS'}</div>
              <div style={{ color: '#fbbf24' }}>{reasoning.flags.length ? reasoning.flags.join(' · ') : '— none —'}</div>
              <div style={{ marginTop: 14, color: '#64748b' }}>{'// FINGERPRINT BEST MATCH'}</div>
              <div style={{ color: '#a5b4fc' }}>
                {reasoning.fingerprintBestMatch
                  ? `${reasoning.fingerprintBestMatch.fingerprint.label} · sim ${(
                      reasoning.fingerprintBestMatch.similarity * 100
                    ).toFixed(1)}% · [${reasoning.fingerprintBestMatch.matchedSignals.join(', ')}]`
                  : '— no significant overlap —'}
              </div>
              <div style={{ marginTop: 14, color: '#64748b' }}>{'// CREATOR CLUSTER'}</div>
              <div style={{ color: '#e2e8f0' }}>
                {reasoning.clusterAnalysis.summary} ({reasoning.clusterAnalysis.linkedCreatorRisk})
              </div>
            </div>
          </section>
        </div>

        {!canUseDeepApi && (
          <p style={{ marginTop: 22, fontSize: 12, color: '#6b7280' }}>
            Session: {session.email ?? 'anonymous'} · tier: {session.tier}. Upgrade for API, audit export, and Pulse-backed scans.
          </p>
        )}
      </div>
    </>
  )
}
