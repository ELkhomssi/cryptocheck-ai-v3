'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReasoningObject } from '@/lib/services/scanner-engine'
import { ConfidenceMeter } from '@/components/pro/institutional/ConfidenceMeter'
import { EnterpriseTrustStrip } from '@/components/pro/institutional/EnterpriseTrustStrip'

export type LivePerfMeta = {
  responseTimeMs: number | null
  cacheHit: boolean | null
  rpcLabel: string
  lastUpdatedIso: string
}

type Props = {
  /** Target safety score 0–100 */
  targetScore: number
  verdict: ReasoningObject['verdict']
  confidence: number
  perf: LivePerfMeta | null
  loading: boolean
  placeholder: string
}

function badgeColors(verdict: ReasoningObject['verdict']): { bg: string; border: string; fg: string } {
  if (verdict === 'SAFE') return { bg: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.45)', fg: '#34d399' }
  if (verdict === 'CAUTION') return { bg: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.45)', fg: '#fbbf24' }
  return { bg: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.45)', fg: '#f87171' }
}

function verdictLabel(v: ReasoningObject['verdict']): string {
  if (v === 'SAFE') return 'SAFE'
  if (v === 'CAUTION') return 'CAUTION'
  if (v === 'HIGH_RISK') return 'HIGH RISK'
  return 'CRITICAL'
}

export function LiveScoreDisplay({ targetScore, verdict, confidence, perf, loading, placeholder }: Props) {
  const [displayScore, setDisplayScore] = useState(0)
  const badge = badgeColors(verdict)

  useEffect(() => {
    if (loading) {
      setDisplayScore(0)
      return
    }
    const target = Math.max(0, Math.min(100, Math.round(targetScore)))
    const start = performance.now()
    const dur = 400
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - (1 - t) * (1 - t)
      setDisplayScore(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [targetScore, loading])

  type TrustStripInput = {
    rpcProvider: string
    lastUpdatedIso: string
    confidence01: number
    cache?: 'hit' | 'miss'
  }

  const strip: TrustStripInput = useMemo(() => {
    if (!perf) {
      return {
        rpcProvider: '—',
        lastUpdatedIso: new Date().toISOString(),
        confidence01: confidence,
      }
    }
    const out: TrustStripInput = {
      rpcProvider: perf.rpcLabel,
      lastUpdatedIso: perf.lastUpdatedIso,
      confidence01: confidence,
    }
    if (perf.cacheHit === true) out.cache = 'hit'
    else if (perf.cacheHit === false) out.cache = 'miss'
    return out
  }, [perf, confidence])

  return (
    <section
      aria-busy={loading}
      style={{
        position: 'relative',
        borderRadius: 20,
        padding: 'clamp(22px,4vw,36px) clamp(18px,4vw,32px)',
        marginBottom: 'clamp(16px,3vw,22px)',
        border: '0.5px solid rgba(16,185,129,0.15)',
        background: 'linear-gradient(165deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.03) 48%, rgba(0,0,0,0.2) 100%)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 50% at 50% -20%, rgba(16,185,129,0.15), transparent)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative' }}>
        <EnterpriseTrustStrip {...strip} />

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
            SECURITY SCORE
          </div>
          {loading ? (
            <div
              style={{
                height: 72,
                margin: '12px auto',
                maxWidth: 220,
                borderRadius: 12,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
                backgroundSize: '200% 100%',
                animation: 'cc-shimmer 1.1s ease-in-out infinite',
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 'clamp(52px,14vw,92px)',
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                color: '#f8fafc',
                textShadow: '0 0 60px rgba(16,185,129,0.25)',
                transition: 'opacity 0.2s ease',
              }}
            >
              {displayScore}
            </div>
          )}
          {!loading && perf?.responseTimeMs != null ? (
            <p style={{ marginTop: 10, fontSize: 11, color: '#64748b', letterSpacing: '0.06em' }} dir="ltr">
              Scanned in {perf.responseTimeMs}ms · SENTINEL v2
              <br />
              <span style={{ color: '#94a3b8' }}>
                via Helius + DexScreener · cache {perf.cacheHit === true ? 'hit' : perf.cacheHit === false ? 'miss' : '—'}
              </span>
            </p>
          ) : !loading ? (
            <p style={{ marginTop: 10, fontSize: 11, color: '#64748b' }}>{placeholder}</p>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxWidth: 420,
            margin: '0 auto 18px',
            textAlign: 'start',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 10,
              border: '0.5px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            <span style={{ fontSize: 12, letterSpacing: '0.14em', color: '#64748b', fontWeight: 600 }}>STATUS</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.14em',
                padding: '6px 14px',
                borderRadius: 8,
                ...badge,
              }}
            >
              {loading ? '…' : verdictLabel(verdict)}
            </span>
          </div>
        </div>

        <ConfidenceMeter value01={confidence} />

        <style
          dangerouslySetInnerHTML={{
            __html: `@keyframes cc-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`,
          }}
        />
      </div>
    </section>
  )
}
