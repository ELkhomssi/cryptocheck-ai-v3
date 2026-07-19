'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { Home, LayoutDashboard } from 'lucide-react'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { useSolana } from '@/components/SolanaProvider'
import { handleMobileAwareWalletConnect } from '@/lib/solana/mobile-wallet-connect'
import type { ProDashboardSession } from '@/lib/types/pro-dashboard'
import type { EvidenceLine, ReasoningObject, WeightedSecurityScore } from '@cryptocheck/types'
import type { ScanV1ApiResponse } from '@/lib/types/institutional-scan-api'
import { CryptoCheckLogo } from '@/components/brand/CryptoCheckLogo'
import { ForDevelopersBadge } from '@/components/landing/ForDevelopersBadge'
import { PulseFeed } from '@/components/pro/PulseFeed'
import { HeroScanner } from '@/components/pro/HeroScanner'
import type { LivePerfMeta } from '@/components/pro/LiveScoreDisplay'
import { RiskBreakdownPanel } from '@/components/pro/institutional/RiskBreakdownPanel'
import { WhyItMattersBlock } from '@/components/pro/institutional/WhyItMattersBlock'
import { WalletIntelGraph } from '@/components/pro/institutional/WalletIntelGraph'
import { InstitutionalI18nProvider, useInstitutionalTranslation } from '@/lib/i18n/institutional-context'
import type { InstitutionalLocale } from '@/lib/i18n/institutional-catalog'
import { useVerifiedCryptocheckAccessKey } from '@/lib/hooks/useVerifiedCryptocheckAccessKey'

type Props = {
  session: ProDashboardSession
  demoReasoning: ReasoningObject
  demoWeighted: WeightedSecurityScore
  demoRpcLabel: string
}

const API_REQUIRED_TOOLTIP = 'Action restricted: API Key required.'

function asPlainText(value: unknown, context: string): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[pro/dashboard] Expected plain text for ${context}:`, value)
  }
  return ''
}

function formatPipelineStages(stages: unknown): string {
  if (!Array.isArray(stages) || stages.length === 0) return ''
  return stages
    .map((raw) => {
      const s = raw as Record<string, unknown>
      const name = typeof s?.name === 'string' ? s.name : asPlainText(s?.name, 'pipeline_stage.name')
      const msRaw = s?.durationMs
      const ms = typeof msRaw === 'number' && Number.isFinite(msRaw) ? msRaw : 0
      return `${name || 'stage'}:${ms}ms`
    })
    .join(' · ')
}

function formatSignalList(signals: unknown): string {
  if (!Array.isArray(signals)) return ''
  return signals.map((x) => asPlainText(x, 'fingerprint.signal')).filter(Boolean).join(', ')
}

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

function verdictColor(v: ReasoningObject['verdict']): string {
  if (v === 'CRITICAL_RISK') return '#f87171'
  if (v === 'HIGH_RISK') return '#fb923c'
  if (v === 'CAUTION') return '#fbbf24'
  return '#34d399'
}

function sanitizeEvidenceDetail(
  line: EvidenceLine,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  const d = line.detail
  if (line.id !== 'ev_live_simulation' && line.category !== 'simulation') return d
  if (/placeholder OK/i.test(d)) {
    return t('institutional.evidence.simulation_detail_placeholder_ok')
  }
  if (/simulateTransaction.*failure|honeypot|revert/i.test(d)) {
    return t('institutional.evidence.simulation_detail_honeypot')
  }
  return d.replace(/placeholder/gi, t('institutional.evidence.simulation_detail_sandbox'))
}

function sanitizeDynamicSummary(
  raw: string,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  return raw.replace(/placeholder/gi, t('institutional.evidence.dynamic_rpc_placeholder'))
}

function buildSimulationNarrative(
  scan: ScanV1ApiResponse | null,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  if (!scan) {
    return t('institutional.simulation.narrative_empty')
  }
  const sellOk = scan.simulator.sell.ok
  const hp = scan.simulator.honeypotLikelihood
  return t('institutional.simulation.narrative_live', {
    sellState: sellOk ? t('institutional.simulation.sell_cleared') : t('institutional.simulation.sell_flagged'),
    honeypot: String(hp),
  })
}

function LocaleSwitcher() {
  const { locale, setLocale, t } = useInstitutionalTranslation()
  const opts: { id: InstitutionalLocale; label: string }[] = [
    { id: 'en', label: 'EN' },
    { id: 'fr', label: 'FR' },
    { id: 'ar', label: 'AR' },
  ]
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: '#64748b', marginInlineEnd: 4 }}>{t('institutional.locale_switch.label')}</span>
      {opts.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setLocale(id)}
          style={{
            fontSize: 11,
            fontWeight: locale === id ? 700 : 500,
            padding: '4px 10px',
            borderRadius: 6,
            border: `0.5px solid ${locale === id ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.12)'}`,
            background: locale === id ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
            color: locale === id ? '#6ee7b7' : '#94a3b8',
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function ProDashboardClientInner({
  session,
  demoReasoning,
  demoWeighted,
  demoRpcLabel,
}: Props) {
  const { t, locale } = useInstitutionalTranslation()
  const [scanResponse, setScanResponse] = useState<ScanV1ApiResponse | null>(null)
  const [prefillMint, setPrefillMint] = useState<string | null>(null)
  const [exportMint, setExportMint] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [dlBusy, setDlBusy] = useState<'pdf' | 'copy' | null>(null)
  const { ready: accessReady, hasValidKey: hasApiAccess } = useVerifiedCryptocheckAccessKey()
  const { connect, disconnect, isConnected, shortAddr, isConnecting } = useSolana()
  const handleWalletConnectClick = useCallback(() => {
    if (isConnected) {
      disconnect()
      return
    }
    void handleMobileAwareWalletConnect(connect)
  }, [isConnected, disconnect, connect])

  const tierHint = useMemo(() => {
    if (!session.userId) return t('institutional.page.tier_hint_signed_out')
    if (!session.hasDeepAccess) return t('institutional.page.tier_hint_upgrade')
    return null
  }, [session, t])

  const reasoning = scanResponse?.reasoning ?? demoReasoning
  const weighted: WeightedSecurityScore = scanResponse
    ? {
        score: scanResponse.score,
        confidence: scanResponse.confidence,
        risk_breakdown: scanResponse.risk_breakdown,
      }
    : demoWeighted

  const orderedEvidence = useMemo(() => {
    const sim = reasoning.evidence.filter((l) => l.id === 'ev_live_simulation')
    const rest = reasoning.evidence.filter((l) => l.id !== 'ev_live_simulation')
    const sorted = [...rest].sort((a, b) => b.riskContribution - a.riskContribution)
    return [...sim, ...sorted]
  }, [reasoning.evidence])

  const handlePrefillConsumed = useCallback(() => setPrefillMint(null), [])

  const onPulsePick = useCallback((mint: string) => {
    setPrefillMint(mint)
    requestAnimationFrame(() => {
      document.getElementById('pro-live-scanner')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const handleLiveResult = useCallback((scan: ScanV1ApiResponse, _perf: LivePerfMeta, mint: string) => {
    setScanResponse(scan)
    setExportMint(mint)
    setApiError(null)
  }, [])

  async function downloadPdf() {
    if (!scanResponse || !exportMint) return
    setDlBusy('pdf')
    try {
      const r = await fetch('/api/v1/audit/report/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'pdf',
          mint: exportMint,
          tokenName: `Token ${exportMint.slice(0, 4)}…`,
          reasoning: scanResponse.reasoning,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(scanApiErrorMessage(j))
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cryptocheck-audit-${exportMint.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDlBusy(null)
    }
  }

  async function copyApiSnippet() {
    if (!exportMint) return
    setDlBusy('copy')
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.cryptocheckai.com'
      const text = `curl -X POST ${origin}/api/v1/scan \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"mint":"${exportMint}"}'`
      await navigator.clipboard.writeText(text)
      setToast('Copied cURL example to clipboard.')
      window.setTimeout(() => setToast(null), 3200)
    } catch {
      setApiError('Clipboard unavailable in this browser.')
    } finally {
      setDlBusy(null)
    }
  }

  function downloadReasoningJsonLocal() {
    const slug = exportMint ? exportMint.slice(0, 8) : 'scan'
    const blob = new Blob([JSON.stringify(reasoning, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cryptocheck-reasoning-${slug}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const rpcDisplay = scanResponse?.rpc_provider ?? demoRpcLabel
  const lastUpdated = scanResponse?.last_updated ?? new Date().toISOString()
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes cc-pulse-glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.35); }
          50% { opacity: 0.75; box-shadow: 0 0 0 8px rgba(52, 211, 153, 0); }
        }
        .cc-pulse-dot { animation: cc-pulse-glow 2.2s ease-in-out infinite; }
        @keyframes cc-terminal-pulse {
          0%, 100% { border-color: rgba(16, 185, 129, 0.18); box-shadow: inset 0 0 0 0 rgba(16,185,129,0); }
          50% { border-color: rgba(16, 185, 129, 0.42); box-shadow: inset 0 0 24px rgba(16,185,129,0.06); }
        }
        .cc-terminal-live { animation: cc-terminal-pulse 2.8s ease-in-out infinite; }
      `,
        }}
      />

      <div
        dir={dir}
        lang={locale}
        className={GeistSans.className}
        style={{
          maxWidth: 1180,
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
            marginBottom: 24,
            paddingBottom: 16,
            borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          }}
        >
          <CryptoCheckLogo variant="institutional" href="/dashboard" />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <LocaleSwitcher />
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
              {t('institutional.nav.home')}
            </Link>
            <Link
              href="/dashboard"
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
              {t('institutional.nav.dashboard')}
            </Link>
            <button
              type="button"
              onClick={handleWalletConnectClick}
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
              {isConnecting ? t('institutional.nav.connecting') : isConnected ? `✓ ${shortAddr}` : t('institutional.nav.connect_wallet')}
            </button>
          </div>
        </nav>

        <header style={{ marginBottom: 'clamp(16px,3vw,24px)' }}>
          <nav
            aria-label="Breadcrumb"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              fontSize: 11,
              color: '#64748b',
              marginBottom: 10,
            }}
          >
            <Link href="/" style={{ color: '#94a3b8', textDecoration: 'none' }}>
              {t('institutional.page.breadcrumb_home')}
            </Link>
            <span aria-hidden style={{ opacity: 0.5 }}>
              /
            </span>
            <span style={{ color: '#c4b5fd', fontWeight: 600 }}>{t('institutional.page.breadcrumb_current')}</span>
          </nav>
          <div style={{ fontSize: 11, letterSpacing: '0.16em', color: '#64748b', marginBottom: 8 }}>{t('institutional.page.kicker')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1
              style={{
                fontSize: 'clamp(26px,4.5vw,36px)',
                fontWeight: 700,
                margin: 0,
                letterSpacing: '-0.04em',
                color: '#f8fafc',
                lineHeight: 1.15,
              }}
            >
              {t('institutional.page.title')}
            </h1>
            <ForDevelopersBadge size="md" />
          </div>
          <p
            style={{
              color: '#e2e8f0',
              fontSize: 'clamp(15px,2.8vw,17px)',
              marginTop: 12,
              maxWidth: 640,
              fontWeight: 500,
              lineHeight: 1.45,
            }}
          >
            {t('institutional.page.subtitle')}
          </p>
          <p style={{ color: '#94a3b8', fontSize: 'clamp(12px,2.2vw,13px)', marginTop: 10, maxWidth: 680, lineHeight: 1.55 }}>
            {t('institutional.page.description')}{' '}
            <code style={{ fontSize: 12, color: '#6ee7b7' }} dir="ltr">
              POST /api/v1/scan
            </code>
            .
          </p>
          <p style={{ color: '#6ee7b7', fontSize: 12, marginTop: 8 }}>
            Dashboard Pro — explainable Solana token intelligence for builders and API consumers.
          </p>
          {tierHint ? <p style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>{tierHint}</p> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18, alignItems: 'center' }}>
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
              {t('institutional.page.consumer_app')}
            </Link>
            {!session.userId && (
              <Link
                href="/landing"
                style={{
                  fontSize: 12,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '0.5px solid rgba(16,185,129,0.4)',
                  color: '#6ee7b7',
                  textDecoration: 'none',
                }}
              >
                {t('institutional.page.sign_in')}
              </Link>
            )}
            {session.userId && !session.hasDeepAccess && (
              <span style={{ fontSize: 12, color: '#fbbf24' }}>{t('institutional.page.pro_lock')}</span>
            )}
          </div>
        </header>

        <section
          style={{
            marginBottom: 18,
            borderRadius: 14,
            border: '0.5px solid rgba(255,255,255,0.1)',
            background: 'rgba(2,6,23,0.5)',
            padding: '12px 14px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#64748b' }}>CRYPTOCHECK ACCESS</div>
          {!accessReady ? (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Checking session…</span>
          ) : hasApiAccess ? (
            <span style={{ fontSize: 11, color: '#6ee7b7' }}>Access key active — live tools enabled.</span>
          ) : (
            <span style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
              Add your key once in the{' '}
              <Link href="/dashboard/intelligence-terminal" style={{ color: '#6ee7b7', textDecoration: 'none', fontWeight: 600 }}>
                Analysis Console
              </Link>
              . It unlocks Scan, Investigate, and Monitor across the product.
            </span>
          )}
        </section>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <Link
            href="/dashboard/api-keys"
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '7px 12px',
              borderRadius: 8,
              border: '0.5px solid rgba(56,189,248,0.35)',
              background: 'rgba(56,189,248,0.1)',
              color: '#7dd3fc',
              textDecoration: 'none',
            }}
          >
            Manage Keys
          </Link>
          <button
            type="button"
            onClick={() => document.getElementById('pro-live-scanner')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            disabled={!accessReady || !hasApiAccess}
            title={accessReady && !hasApiAccess ? API_REQUIRED_TOOLTIP : undefined}
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '7px 12px',
              borderRadius: 8,
              border: '0.5px solid rgba(16,185,129,0.45)',
              background: 'rgba(16,185,129,0.1)',
              color: accessReady && hasApiAccess ? '#6ee7b7' : '#64748b',
              cursor: accessReady && hasApiAccess ? 'pointer' : 'not-allowed',
            }}
          >
            Scan
          </button>
          {accessReady && hasApiAccess ? (
            <Link
              href="/dashboard/investigate"
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '7px 12px',
                borderRadius: 8,
                border: '0.5px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e2e8f0',
                textDecoration: 'none',
              }}
            >
              Investigate
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title={accessReady ? API_REQUIRED_TOOLTIP : undefined}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '7px 12px',
                borderRadius: 8,
                border: '0.5px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                color: '#64748b',
                cursor: 'not-allowed',
              }}
            >
              Investigate
            </button>
          )}
          <button
            type="button"
            onClick={() => document.getElementById('pro-monitor-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            disabled={!accessReady || !hasApiAccess}
            title={accessReady && !hasApiAccess ? API_REQUIRED_TOOLTIP : undefined}
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '7px 12px',
              borderRadius: 8,
              border: '0.5px solid rgba(251,191,36,0.35)',
              background: 'rgba(251,191,36,0.1)',
              color: accessReady && hasApiAccess ? '#fcd34d' : '#64748b',
              cursor: accessReady && hasApiAccess ? 'pointer' : 'not-allowed',
            }}
          >
            Monitor
          </button>
        </div>

        <HeroScanner
          prefillMint={prefillMint}
          onPrefillConsumed={handlePrefillConsumed}
          onLiveResult={handleLiveResult}
          initialScore={demoWeighted.score}
          initialVerdict={demoReasoning.verdict}
          initialConfidence={demoWeighted.confidence}
          hasApiAccess={accessReady && hasApiAccess}
          restrictionTooltip={API_REQUIRED_TOOLTIP}
        />
        {toast ? (
          <div
            style={{
              marginBottom: 12,
              fontSize: 12,
              color: '#6ee7b7',
              padding: '10px 12px',
              borderRadius: 10,
              border: '0.5px solid rgba(16,185,129,0.25)',
              background: 'rgba(16,185,129,0.08)',
            }}
          >
            {toast}
          </div>
        ) : null}

        <WhyItMattersBlock
          verdict={reasoning.verdict}
          reasoning={reasoning}
          weighted={weighted}
          canonical={scanResponse?.canonical ?? null}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)',
            gap: 'clamp(14px,3vw,22px)',
            marginTop: 20,
            alignItems: 'start',
          }}
          className="pro-term-grid"
        >
          <style>{`
            @media (max-width: 960px) {
              .pro-term-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>

          <RiskBreakdownPanel breakdown={weighted.risk_breakdown} />

          <div
            style={{
              borderRadius: 16,
              padding: '18px 20px',
              border: '0.5px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: '0.14em', color: '#64748b', marginBottom: 10 }}>
              {t('institutional.simulation.layer_title')}
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.55, margin: 0 }}>{buildSimulationNarrative(scanResponse, t)}</p>
            {!scanResponse ? (
              <p style={{ marginTop: 10, fontSize: 11, color: '#64748b' }}>Run a live scan above to populate simulation context.</p>
            ) : null}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <WalletIntelGraph reasoning={reasoning} />
        </div>

        {scanResponse ? (
          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              color: '#94a3b8',
              lineHeight: 1.5,
              padding: '12px 14px',
              borderRadius: 12,
              border: '0.5px solid rgba(16,185,129,0.12)',
              background: 'rgba(16,185,129,0.04)',
            }}
          >
            <strong style={{ color: '#6ee7b7' }}>{t('institutional.wallet_reputation.prefix')}</strong> —{' '}
            {asPlainText(scanResponse.wallet_reputation.summary, 'wallet_reputation.summary')}{' '}
            {t('institutional.wallet_reputation.score', { score: scanResponse.wallet_reputation.score0to100 })}
          </div>
        ) : null}

        <div id="pro-monitor-section" style={{ marginTop: 28 }}>
          <PulseFeed onPickMint={onPulsePick} />
        </div>

        <section
          style={{
            marginTop: 28,
            borderRadius: 14,
            border: '0.5px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
            backdropFilter: 'blur(12px)',
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
              <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#64748b' }}>{t('institutional.evidence.section_label')}</div>
              <div style={{ fontSize: 'clamp(12px,2.5vw,13px)', color: '#cbd5e1', marginTop: 6, lineHeight: 1.5 }} dir="ltr">
                {t('institutional.evidence.grade_line', {
                  grade: reasoning.institutionalGrade,
                  verdict: reasoning.verdict,
                  confidence: reasoning.confidenceScore,
                })}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={!scanResponse || dlBusy !== null}
                onClick={() => void downloadPdf()}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '0.5px solid rgba(16,185,129,0.25)',
                  background: 'rgba(16,185,129,0.06)',
                  color: '#6ee7b7',
                  cursor: scanResponse ? 'pointer' : 'not-allowed',
                }}
              >
                {dlBusy === 'pdf' ? '…' : t('institutional.evidence.pdf_audit')}
              </button>
              <button
                type="button"
                disabled={!exportMint || dlBusy !== null}
                onClick={() => void copyApiSnippet()}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '0.5px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#e2e8f0',
                  cursor: exportMint ? 'pointer' : 'not-allowed',
                }}
                aria-label="Copy API cURL example to clipboard"
              >
                {dlBusy === 'copy' ? '…' : 'Export JSON (API)'}
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
                {t('institutional.evidence.download_json_local')}
              </button>
            </div>
          </div>

          {!scanResponse ? (
            <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
              Run a live scan to enable PDF export and API snippet copy.
            </div>
          ) : null}

          {apiError ? <div style={{ marginTop: 12, fontSize: 12, color: '#f87171' }}>{apiError}</div> : null}

          {reasoning.dynamicSimulation ? (
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
              <strong style={{ color: '#fca5a5' }}>{t('institutional.evidence.dynamic_simulation')}</strong> —{' '}
              {sanitizeDynamicSummary(reasoning.dynamicSimulation.summary, t)}
              {reasoning.dynamicSimulation.realizedTaxOrSlippagePct != null ? (
                <span dir="ltr">
                  {' '}
                  · {t('institutional.evidence.tax_est')} {reasoning.dynamicSimulation.realizedTaxOrSlippagePct.toFixed(2)}%
                </span>
              ) : null}
            </div>
          ) : null}

          <div
            className={`${GeistMono.className} cc-terminal-live`}
            style={{
              marginTop: 18,
              padding: 'clamp(12px,3vw,16px) clamp(12px,3vw,18px)',
              borderRadius: 10,
              border: '0.5px solid rgba(16, 185, 129, 0.22)',
              background: 'rgba(0,0,0,0.4)',
              fontSize: 'clamp(11px,2.4vw,12px)',
              lineHeight: 1.65,
              color: '#cbd5e1',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div style={{ color: '#64748b', marginBottom: 8 }}>{t('institutional.evidence.raw_evidence')}</div>
            {orderedEvidence.map((line) => (
              <div key={line.id} style={{ marginBottom: 10 }}>
                <span style={{ color: '#6ee7b7' }}>[{line.category}]</span>{' '}
                <span style={{ color: '#f1f5f9' }}>{line.label}</span>
                {line.riskContribution > 0 ? (
                  <span style={{ color: '#fb923c' }}>
                    {' '}
                    {t('institutional.evidence.risk_prefix')}
                    {line.riskContribution.toFixed(0)}
                  </span>
                ) : null}
                <div style={{ color: '#94a3b8', marginTop: 2 }}>{sanitizeEvidenceDetail(line, t)}</div>
              </div>
            ))}
            <div style={{ marginTop: 14, color: '#64748b' }}>{t('institutional.evidence.flags')}</div>
            <div style={{ color: '#fbbf24' }}>
              {reasoning.flags.length
                ? reasoning.flags.map((f) => asPlainText(f, 'reasoning.flag')).join(' · ')
                : t('institutional.evidence.none_flags')}
            </div>
            <div style={{ marginTop: 14, color: '#64748b' }}>{t('institutional.evidence.pipeline')}</div>
            <div style={{ color: '#a7f3d0' }} dir="ltr">
              {scanResponse?.pipeline_stages?.length
                ? formatPipelineStages(scanResponse.pipeline_stages)
                : t('institutional.evidence.pipeline_empty')}
            </div>
            <div style={{ marginTop: 14, color: '#64748b' }}>{t('institutional.evidence.fingerprint')}</div>
            <div style={{ color: '#6ee7b7' }} dir="ltr">
              {reasoning.fingerprintBestMatch
                ? `${asPlainText(reasoning.fingerprintBestMatch.fingerprint.label, 'fingerprint.label')} · sim ${(
                    reasoning.fingerprintBestMatch.similarity * 100
                  ).toFixed(1)}% · [${formatSignalList(reasoning.fingerprintBestMatch.matchedSignals)}]`
                : t('institutional.evidence.fingerprint_none')}
            </div>
            <div style={{ marginTop: 14, color: '#64748b' }}>{t('institutional.evidence.cluster')}</div>
            <div style={{ color: '#e2e8f0' }}>
              {asPlainText(reasoning.clusterAnalysis.summary, 'clusterAnalysis.summary')} (
              {asPlainText(reasoning.clusterAnalysis.linkedCreatorRisk, 'clusterAnalysis.linkedCreatorRisk')})
            </div>
          </div>
        </section>

        {!session.hasDeepAccess ? (
          <p style={{ marginTop: 22, fontSize: 12, color: '#64748b' }}>
            {t('institutional.session_footer', { email: session.email ?? 'anonymous', tier: session.tier })}
          </p>
        ) : null}
      </div>
    </>
  )
}

export function ProDashboardClient(props: Props) {
  return (
    <InstitutionalI18nProvider>
      <ProDashboardClientInner {...props} />
    </InstitutionalI18nProvider>
  )
}
