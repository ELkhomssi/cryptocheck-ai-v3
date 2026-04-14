'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { GeistMono } from 'geist/font/mono'
import type { ProDashboardSession } from '@/lib/types/pro-dashboard'
import type { ReasoningObject } from '@/lib/services/scanner-engine'

type Props = {
  session: ProDashboardSession
  demoReasoning: ReasoningObject
}

export function ProDashboardClient({ session, demoReasoning }: Props) {
  const [reasoning, setReasoning] = useState<ReasoningObject>(demoReasoning)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const canUseDeepApi = session.hasDeepAccess

  const headline = useMemo(() => {
    if (!session.userId) return 'Institutional Terminal — preview mode'
    if (!session.hasDeepAccess) return 'Institutional Terminal — upgrade for live reasoning API'
    return 'Institutional Terminal'
  }, [session])

  async function runLiveReasoning() {
    if (!canUseDeepApi) return
    setLoading(true)
    setApiError(null)
    try {
      const r = await fetch('/api/v1/scan/reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
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

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px clamp(16px,4vw,40px) 80px' }}>
      <header style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#6b7280', marginBottom: 10 }}>
          CRYPTOCHECK AI · PRO
        </div>
        <h1 style={{ fontSize: 'clamp(22px,3vw,28px)', fontWeight: 600, margin: 0, letterSpacing: '-0.03em' }}>
          {headline}
        </h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 10, maxWidth: 560 }}>
          Raw evidence lines, fingerprint similarity, and creator-cluster signals — same contract as{' '}
          <code style={{ fontSize: 12, color: '#a5b4fc' }}>/api/v1/scan/reasoning</code> (Pro+).
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
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
            <span style={{ fontSize: 12, color: '#fbbf24', alignSelf: 'center' }}>
              Deep analysis API requires Pro or Institutional.
            </span>
          )}
        </div>
      </header>

      <section
        style={{
          borderRadius: 14,
          border: '0.5px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
          backdropFilter: 'blur(18px)',
          padding: '20px 22px 24px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#6b7280' }}>AI REASONING · TERMINAL</div>
            <div style={{ fontSize: 13, color: '#d1d5db', marginTop: 4 }}>
              Verdict <span style={{ color: '#a5b4fc' }}>{reasoning.verdict}</span> · Score{' '}
              <span style={{ color: '#34d399' }}>{reasoning.aggregateScore}</span> / 100 · Confidence{' '}
              {reasoning.confidenceScore}%
            </div>
          </div>
          <button
            type="button"
            disabled={!canUseDeepApi || loading}
            onClick={() => void runLiveReasoning()}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 8,
              border: '0.5px solid rgba(52, 211, 153, 0.35)',
              background: canUseDeepApi ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.04)',
              color: canUseDeepApi ? '#6ee7b7' : '#6b7280',
              cursor: canUseDeepApi ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Running…' : 'Run live reasoning (API)'}
          </button>
        </div>

        {apiError && (
          <div style={{ marginTop: 12, fontSize: 12, color: '#f87171' }}>{apiError}</div>
        )}

        <div
          className={GeistMono.className}
          style={{
            marginTop: 18,
            padding: '16px 18px',
            borderRadius: 10,
            border: '0.5px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.35)',
            fontSize: 12,
            lineHeight: 1.65,
            color: '#cbd5e1',
            overflowX: 'auto',
          }}
        >
          <div style={{ color: '#64748b', marginBottom: 8 }}>{'// RAW EVIDENCE'}</div>
          {reasoning.evidence.map((line) => (
            <div key={line.id} style={{ marginBottom: 10 }}>
              <span style={{ color: '#818cf8' }}>[{line.category}]</span> <span style={{ color: '#f1f5f9' }}>{line.label}</span>
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
          <div style={{ marginTop: 14, color: '#64748b' }}>{'// CREATOR CLUSTER (placeholder)'}</div>
          <div style={{ color: '#e2e8f0' }}>
            {reasoning.clusterAnalysis.summary} ({reasoning.clusterAnalysis.linkedCreatorRisk})
          </div>
        </div>
      </section>

      {!canUseDeepApi && (
        <p style={{ marginTop: 20, fontSize: 12, color: '#6b7280' }}>
          Session: {session.email ?? 'anonymous'} · tier: {session.tier}. Upgrade in-app or set{' '}
          <code style={{ color: '#93c5fd' }}>plan = pro</code> on your profile for API access.
        </p>
      )}
    </div>
  )
}
