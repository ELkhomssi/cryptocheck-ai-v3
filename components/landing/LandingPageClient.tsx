'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GeistSans } from 'geist/font/sans'
import { CryptoCheckLogo } from '@/components/brand/CryptoCheckLogo'
import {
  ProductDemoTheater,
  type DemoProductKey,
} from '@/components/landing/ProductDemoTheater'
import { DashboardProDemoPreview } from '@/components/landing/DashboardProDemoPreview'
import { ForDevelopersBadge } from '@/components/landing/ForDevelopersBadge'
import { LandingHeroScanPanel } from '@/components/landing/LandingHeroScanPanel'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { LandingPublicStats } from '@/lib/landing/types'
import { launchLabHubCopy } from '@/lib/landing/launchlab-card'
import { DEFAULT_PLATFORM_FEE_BPS } from '@/lib/revenue-dashboard/constants'
import { LAUNCHPAD_FEE_NOTE } from '@/lib/launchpad/constants'

/** Injected as raw CSS to avoid hydration mismatches from React normalizing `<style>` text children. */
const LANDING_PAGE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700;800&display=swap');
@keyframes fadeInUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
@keyframes lp-pulse { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(32,178,170,0.4); } 50% { opacity:0.6; box-shadow:0 0 0 4px rgba(32,178,170,0); } }
html { scroll-behavior:smooth; }
.lp-cta:hover { transform:translateY(-2px); box-shadow:0 0 40px rgba(32,178,170,0.45),0 8px 30px rgba(0,0,0,0.4) !important; }
.lp-feature-card:hover { border-color:rgba(32,178,170,0.3) !important; transform:translateY(-2px); }
.lp-hub-card:hover { border-color:rgba(32,178,170,0.35) !important; transform:translateY(-3px); box-shadow:0 16px 40px rgba(0,0,0,0.35); }
.lp-hero-grid { grid-template-columns:1fr 1fr; }
.lp-steps-grid { grid-template-columns:repeat(3,1fr); }
.lp-features-grid { grid-template-columns:repeat(3,1fr); }
.lp-hub-grid { grid-template-columns:repeat(2,1fr); }
.lp-stats-grid { grid-template-columns:repeat(4,1fr); }
@media (max-width:900px) {
  .lp-hero-grid { grid-template-columns:1fr !important; }
  .lp-steps-grid { grid-template-columns:1fr !important; }
  .lp-features-grid { grid-template-columns:1fr !important; }
  .lp-hub-grid { grid-template-columns:1fr !important; }
  .lp-stats-grid { grid-template-columns:repeat(2,1fr) !important; }
  .lp-nav-link { display:none !important; }
  .lp-mobile-nav { display:flex !important; }
}
::-webkit-scrollbar { width:6px; }
::-webkit-scrollbar-track { background:#000; }
::-webkit-scrollbar-thumb { background:rgba(32,178,170,0.3); border-radius:3px; }
`.trim()

const PLATFORM_FEE_PCT = (DEFAULT_PLATFORM_FEE_BPS / 100).toFixed(2)

type HubCard = {
  key: DemoProductKey
  title: string
  eyebrow: string
  desc: string
  href: string
  hrefLabel: string
  accent: string
}

function buildHubCards(launchLabLive: boolean): HubCard[] {
  const launch = launchLabHubCopy(launchLabLive)
  return [
    {
      key: 'dashboard',
      title: 'Trading Dashboard',
      eyebrow: 'TRADE',
      desc: 'Scan, swap, and snipe from one workspace. Alpha Feed surfaces opportunities before you commit.',
      href: '/dashboard',
      hrefLabel: 'Open /dashboard →',
      accent: '#20b2aa',
    },
    {
      key: 'launchlab',
      title: 'LaunchLAB',
      eyebrow: launch.eyebrow,
      desc: launch.desc,
      href: launch.href,
      hrefLabel: launch.hrefLabel,
      accent: '#f59e0b',
    },
    {
      key: 'dashboardPro',
      title: 'Dashboard Pro',
      eyebrow: 'DEV',
      desc: 'Evidence-backed token intelligence for developers — API, explainable verdicts, audit-ready exports.',
      href: '/pro/dashboard',
      hrefLabel: 'Open /pro/dashboard →',
      accent: '#818cf8',
    },
    {
      key: 'app',
      title: 'App',
      eyebrow: 'SCAN',
      desc: 'Consumer Neural Scanner. Paste a mint, get a verdict. /app unchanged.',
      href: '/app',
      hrefLabel: 'Open /app →',
      accent: '#00d4aa',
    },
  ]
}

export type LandingPageClientProps = {
  publicStats: LandingPublicStats
  launchLabLive: boolean
}

export default function LandingPageClient({ publicStats, launchLabLive }: LandingPageClientProps) {
  const [scrollY, setScrollY] = useState(0)
  const [activeDemo, setActiveDemo] = useState<DemoProductKey>('dashboard')
  const hubCards = buildHubCards(launchLabLive)

  useEffect(() => {
    const h = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  function watchDemo(key: DemoProductKey) {
    setActiveDemo(key)
    window.setTimeout(() => {
      const target =
        key === 'dashboardPro'
          ? document.getElementById('interactive-demo') ?? document.getElementById('hub-demo')
          : document.getElementById('hub-demo')
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 40)
  }

  function handleGoogleSignup() {
    if (!isSupabaseConfigured()) {
      alert(
        'Sign-in is not configured in this environment. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.'
      )
      return
    }
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase()
      const inAppWallet = ['phantom', 'metamask', 'trust', 'coinbasewallet', 'tokenpocket', 'okx', 'rainbow'].some((s) =>
        ua.includes(s)
      )
      if (inAppWallet) {
        const appUrl = 'https://www.cryptocheckai.com/app'
        navigator.clipboard?.writeText(appUrl).catch(() => {})
        alert('Google sign-in may be blocked in wallet browsers. Link copied — open in Safari/Chrome: ' + appUrl)
        return
      }
    }
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://www.cryptocheckai.com/app',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  const steps = [
    {
      num: '01',
      title: 'Watch a demo',
      icon: '▶',
      accent: '#20b2aa',
      desc: 'Every product auto-plays a walkthrough on this page. No signup required to watch.',
    },
    {
      num: '02',
      title: 'Click inside (optional)',
      icon: '🖐️',
      accent: '#00d4aa',
      desc: 'Enable “click inside” on the live preview to poke the real surface — still from Landing.',
    },
    {
      num: '03',
      title: 'Go where you need',
      icon: '🚀',
      accent: '#d4af37',
      desc: 'Open that route when ready. Sign up only when you want live credits.',
    },
  ]

  const features = [
    {
      icon: '🧠',
      title: 'Neural Scan V4',
      desc: 'AI scores 0–100 across risk vectors. Fast, explainable SAFE / CAUTION / DANGER verdicts.',
    },
    { icon: '🐋', title: 'Whale Tracking', desc: 'Follow smart money. See what top wallets are buying before the crowd.' },
    { icon: '🔍', title: 'Rug Forensics Lab', desc: 'Post-mortem analysis on rug pulls. Learn the patterns, avoid the traps.' },
    {
      icon: '🎯',
      title: 'AI Auto-Sniper',
      desc: `Automated entry on high-confidence signals. Transparent ${PLATFORM_FEE_PCT}% platform fee, shown before every trade. ${LAUNCHPAD_FEE_NOTE}`,
    },
    { icon: '📊', title: 'Holder Distribution', desc: 'Visualize top wallets, insider clusters, and concentration risk instantly.' },
    { icon: '⚡', title: 'Live Alpha Feed', desc: 'Real-time whale buys, new pools, rug alerts, and volume spikes.' },
  ]

  const stats = publicStats.stats

  return (
    <div
      className={GeistSans.className}
      style={{
        background: '#000',
        color: '#e2e8f0',
        overflow: 'hidden',
        fontFamily: "var(--font-geist-sans), 'IBM Plex Mono', 'JetBrains Mono', monospace",
      }}
    >
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          minHeight: 56,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px clamp(16px,4vw,32px)',
          background: scrollY > 50 ? 'rgba(0,0,0,0.92)' : 'transparent',
          backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
          borderBottom: scrollY > 50 ? '1px solid rgba(32,178,170,0.1)' : '1px solid transparent',
          transition: 'all 0.3s ease',
        }}
      >
        <CryptoCheckLogo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="#how-it-works" className="lp-nav-link" style={{ fontSize: 11, color: '#8b949e', textDecoration: 'none', letterSpacing: '0.05em' }}>
            How it Works
          </a>
          <a href="#demo" className="lp-nav-link" style={{ fontSize: 11, color: '#e2e8f0', textDecoration: 'none', letterSpacing: '0.05em', fontWeight: 600 }}>
            Watch demos
          </a>
          <a href="#interactive-demo" className="lp-nav-link" style={{ fontSize: 11, color: '#818cf8', textDecoration: 'none', letterSpacing: '0.05em', fontWeight: 600 }}>
            Interactive Demo
          </a>
          <a href="#explore" className="lp-nav-link" style={{ fontSize: 11, color: '#8b949e', textDecoration: 'none', letterSpacing: '0.05em' }}>
            Products
          </a>
          <a href="#features" className="lp-nav-link" style={{ fontSize: 11, color: '#8b949e', textDecoration: 'none', letterSpacing: '0.05em' }}>
            Features
          </a>
          <a
            href="/app"
            style={{
              padding: '7px 16px',
              fontSize: 11,
              fontWeight: 700,
              background: 'linear-gradient(135deg,#20b2aa,#00d4aa)',
              color: '#000',
              borderRadius: 6,
              textDecoration: 'none',
              letterSpacing: '0.04em',
            }}
          >
            Launch App →
          </a>
        </div>
        <div
          className="lp-mobile-nav"
          style={{
            width: '100%',
            display: 'none',
            flexWrap: 'wrap',
            gap: 10,
            paddingTop: 6,
            alignItems: 'center',
            justifyContent: 'flex-start',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <a href="#demo" style={{ fontSize: 11, color: '#e2e8f0', textDecoration: 'none', letterSpacing: '0.04em', padding: '6px 10px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.12)' }}>
            Demos
          </a>
          <a href="#interactive-demo" style={{ fontSize: 11, color: '#818cf8', textDecoration: 'none', letterSpacing: '0.04em', padding: '6px 10px', borderRadius: 6, border: '0.5px solid rgba(129,140,248,0.35)' }}>
            Interactive Demo
          </a>
          <button type="button" onClick={() => watchDemo('dashboard')} style={{ fontSize: 11, color: '#8b949e', background: 'none', border: 'none', cursor: 'pointer' }}>
            Dashboard
          </button>
          <button type="button" onClick={() => watchDemo('launchlab')} style={{ fontSize: 11, color: '#8b949e', background: 'none', border: 'none', cursor: 'pointer' }}>
            LaunchLAB
          </button>
          <button type="button" onClick={() => watchDemo('dashboardPro')} style={{ fontSize: 11, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer' }}>
            Dashboard Pro
          </button>
          <button type="button" onClick={() => watchDemo('app')} style={{ fontSize: 11, color: '#20b2aa', background: 'none', border: 'none', cursor: 'pointer' }}>
            App
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden', paddingTop: 'clamp(64px,14vw,96px)' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(32,178,170,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(32,178,170,0.03) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        <div style={{ position: 'absolute', top: '20%', left: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(32,178,170,0.08) 0%,transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div className="lp-hero-grid" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px clamp(16px,4vw,32px)', display: 'grid', gap: 40, alignItems: 'center', width: '100%', position: 'relative', zIndex: 1 }}>
          <div style={{ animation: 'fadeInUp 0.8s ease-out' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: 'rgba(32,178,170,0.08)', border: '1px solid rgba(32,178,170,0.2)', marginBottom: 24 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#20b2aa', animation: 'lp-pulse 2s infinite' }} />
              <span style={{ fontSize: 10, color: '#20b2aa', fontWeight: 600, letterSpacing: '0.06em' }}>
                WATCH DEMOS HERE · THEN GO WHERE YOU NEED
              </span>
            </div>
            <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', fontWeight: 800, lineHeight: 1.1, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
              CryptoCheck AI{' '}
              <span style={{ background: 'linear-gradient(135deg,#20b2aa,#00d4aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                — demo every surface
              </span>
            </h1>
            <p style={{ fontSize: 'clamp(13px,1.5vw,16px)', color: '#8b949e', lineHeight: 1.7, margin: '20px 0 32px', maxWidth: 480 }}>
              Landing shows you Trading Dashboard, LaunchLAB, Dashboard Pro, and App — walkthrough + live preview. Pick what you need after watching.{' '}
              <span style={{ color: '#20b2aa', fontWeight: 700 }}>10 FREE Neural Scans on signup.</span>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
              <a
                href="#demo"
                className="lp-cta"
                style={{
                  padding: '14px 28px',
                  fontSize: 14,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg,#20b2aa,#00d4aa)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#000',
                  letterSpacing: '0.03em',
                  boxShadow: '0 0 30px rgba(32,178,170,0.3),0 4px 20px rgba(0,0,0,0.3)',
                  fontFamily: "'IBM Plex Mono',monospace",
                  transition: 'transform 0.2s,box-shadow 0.2s',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                ▶ Watch demos
              </a>
              <button
                type="button"
                onClick={handleGoogleSignup}
                style={{
                  padding: '14px 28px',
                  fontSize: 14,
                  fontWeight: 700,
                  background: 'transparent',
                  border: '1px solid rgba(32,178,170,0.3)',
                  borderRadius: 8,
                  color: '#20b2aa',
                  cursor: 'pointer',
                  fontFamily: "'IBM Plex Mono',monospace",
                }}
              >
                Start free
              </button>
            </div>
            <div className="lp-stats-grid" style={{ display: 'grid', gap: 16 }}>
              {stats.map((s, i) => (
                <div key={`${s.label}-${i}`} style={{ animation: `fadeInUp 0.6s ease-out ${i * 100}ms both` }}>
                  <div style={{ fontSize: 'clamp(18px,2vw,22px)', fontWeight: 800, color: '#20b2aa', letterSpacing: '-0.02em' }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 8, color: '#484f58', letterSpacing: '0.04em', marginTop: 2 }}>{s.note}</div>
                </div>
              ))}
            </div>
            {publicStats.buildingInPublic ? (
              <p style={{ fontSize: 11, color: '#6e7681', marginTop: 14, maxWidth: 420, lineHeight: 1.5 }}>
                Just getting started — building this in public. Small honest numbers beat fabricated trust signals.
              </p>
            ) : null}
          </div>
          <div style={{ position: 'relative', animation: 'fadeInUp 1s ease-out 0.3s both' }}>
            <div style={{ position: 'absolute', inset: -40, background: 'radial-gradient(circle at center,rgba(32,178,170,0.12) 0%,transparent 60%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <LandingHeroScanPanel realScan={publicStats.heroScan} />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding: 'clamp(60px,10vw,120px) clamp(16px,4vw,32px)', background: 'linear-gradient(180deg,#000 0%,#050a06 100%)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,6vw,64px)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#20b2aa', marginBottom: 12 }}>HOW IT WORKS</div>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
              Watch. Decide. <span style={{ color: '#20b2aa' }}>Enter.</span>
            </h2>
            <p style={{ fontSize: 14, color: '#6e7681', marginTop: 12 }}>Everything you need to choose a product is on this landing page.</p>
          </div>
          <div className="lp-steps-grid" style={{ display: 'grid', gap: 24 }}>
            {steps.map((step, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid rgba(${step.accent === '#d4af37' ? '212,175,55' : '32,178,170'},0.15)`,
                  borderRadius: 12,
                  padding: 'clamp(20px,3vw,32px) clamp(16px,2.5vw,28px)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', top: -20, right: -10, fontSize: 80, fontWeight: 900, color: 'rgba(255,255,255,0.02)', lineHeight: 1 }}>{step.num}</div>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{step.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: step.accent, marginBottom: 8 }}>STEP {step.num}</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.01em' }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO THEATER — source of truth for every product */}
      <section id="demo" style={{ padding: 'clamp(60px,10vw,100px) clamp(16px,4vw,32px)', background: '#000', borderTop: '1px solid rgba(32,178,170,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(24px,4vw,40px)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#20b2aa', marginBottom: 12 }}>DEMO THEATER · ALL PRODUCTS</div>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 800, color: '#fff', margin: 0 }}>
              Watch what each tool <span style={{ color: '#20b2aa' }}>does</span>
            </h2>
            <p style={{ fontSize: 14, color: '#6e7681', marginTop: 12, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
              Auto-play walkthrough + live iframe for Dashboard, LaunchLAB, Dashboard Pro, and App. No signup required to watch.
            </p>
          </div>
          <ProductDemoTheater activeKey={activeDemo} onActiveKeyChange={setActiveDemo} />
        </div>
      </section>

      {/* INTERACTIVE DEMO — Dashboard Pro scaled preview */}
      <section id="interactive-demo" style={{ padding: 'clamp(48px,8vw,88px) clamp(16px,4vw,32px)', background: 'linear-gradient(180deg,#050508 0%,#000 100%)', borderTop: '1px solid rgba(129,140,248,0.12)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(24px,4vw,36px)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#818cf8', marginBottom: 12 }}>INTERACTIVE DEMO</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
                Try <span style={{ color: '#818cf8' }}>Dashboard Pro</span>
              </h2>
              <ForDevelopersBadge size="md" />
            </div>
            <p style={{ fontSize: 14, color: '#6e7681', marginTop: 12, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.65 }}>
              Scaled preview of the developer surface — scan, evidence, and API. Sample data only; open the full product when you&apos;re ready.
            </p>
          </div>
          <DashboardProDemoPreview />
        </div>
      </section>

      {/* PRODUCT MAP */}
      <section id="explore" style={{ padding: 'clamp(48px,8vw,80px) clamp(16px,4vw,32px)', background: 'linear-gradient(180deg,#050a06 0%,#000 100%)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#20b2aa', marginBottom: 12 }}>PRODUCT MAP</div>
            <h2 style={{ fontSize: 'clamp(22px,3vw,32px)', fontWeight: 800, color: '#fff', margin: 0 }}>
              Where each feature <span style={{ color: '#20b2aa' }}>leads</span>
            </h2>
          </div>
          <div className="lp-hub-grid" style={{ display: 'grid', gap: 20 }}>
            {hubCards.map((p) => {
              const on = activeDemo === p.key
              return (
                <div
                  key={p.key}
                  className="lp-hub-card"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${on ? p.accent + '55' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 12,
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    transition: 'border-color 0.25s,transform 0.25s,box-shadow 0.25s',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: p.accent }}>{p.eyebrow}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>{p.title}</h3>
                  <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.65, margin: 0, flex: 1 }}>{p.desc}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => watchDemo(p.key)}
                      style={{
                        padding: '10px 16px',
                        fontSize: 12,
                        fontWeight: 700,
                        background: `linear-gradient(135deg,${p.accent},${p.accent}cc)`,
                        color: p.key === 'dashboardPro' ? '#fff' : '#000',
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: "'IBM Plex Mono',monospace",
                      }}
                    >
                      ▶ Watch demo
                    </button>
                    <a
                      href={p.href}
                      style={{
                        padding: '10px 16px',
                        fontSize: 12,
                        fontWeight: 700,
                        background: 'transparent',
                        border: `1px solid ${p.accent}55`,
                        borderRadius: 8,
                        color: p.accent,
                        textDecoration: 'none',
                      }}
                    >
                      {p.hrefLabel}
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: 'clamp(60px,10vw,100px) clamp(16px,4vw,32px)', background: '#000' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,6vw,56px)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#20b2aa', marginBottom: 12 }}>FEATURES</div>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: 800, color: '#fff', margin: 0 }}>
              Institutional-Grade <span style={{ color: '#20b2aa' }}>Intelligence</span>
            </h2>
          </div>
          <div className="lp-features-grid" style={{ display: 'grid', gap: 20 }}>
            {features.map((f, i) => (
              <div key={i} className="lp-feature-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 24, transition: 'border-color 0.3s,transform 0.3s' }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>{f.title}</h3>
                <p style={{ fontSize: 12, color: '#6e7681', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: 'clamp(60px,10vw,100px) clamp(16px,4vw,32px)', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(32,178,170,0.06) 0%,transparent 60%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Know where you&apos;re going. <span style={{ color: '#20b2aa' }}>Then go.</span>
          </h2>
          <p style={{ fontSize: 15, color: '#6e7681', maxWidth: 500, margin: '0 auto 32px' }}>
            Watch demos free. Sign up when you want live scans. 10 free Neural Scans. No credit card.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <a
              href="#demo"
              className="lp-cta"
              style={{
                padding: '16px 32px',
                fontSize: 15,
                fontWeight: 700,
                background: 'transparent',
                border: '1px solid rgba(32,178,170,0.4)',
                borderRadius: 8,
                color: '#20b2aa',
                textDecoration: 'none',
                fontFamily: "'IBM Plex Mono',monospace",
              }}
            >
              ▶ Back to demos
            </a>
            <button
              type="button"
              onClick={handleGoogleSignup}
              className="lp-cta"
              style={{
                padding: '16px 40px',
                fontSize: 16,
                fontWeight: 700,
                background: 'linear-gradient(135deg,#20b2aa,#00d4aa)',
                border: 'none',
                borderRadius: 8,
                color: '#000',
                cursor: 'pointer',
                fontFamily: "'IBM Plex Mono',monospace",
                boxShadow: '0 0 40px rgba(32,178,170,0.3),0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              ⚡ Start Free — 10 Credits
            </button>
          </div>
        </div>
      </section>

      <footer style={{ padding: '40px clamp(16px,4vw,32px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#20b2aa,#00d4aa)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#000' }}>
              CC
            </div>
            <span style={{ fontSize: 12, color: '#6e7681' }}>© 2026 CryptoCheck AI, Inc. · Delaware C-Corp</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            <button type="button" onClick={() => watchDemo('dashboard')} style={{ fontSize: 11, color: '#484f58', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Dashboard demo
            </button>
            <button type="button" onClick={() => watchDemo('launchlab')} style={{ fontSize: 11, color: '#484f58', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              LaunchLAB demo
            </button>
            <button type="button" onClick={() => watchDemo('dashboardPro')} style={{ fontSize: 11, color: '#484f58', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Dashboard Pro demo
            </button>
            <button type="button" onClick={() => watchDemo('app')} style={{ fontSize: 11, color: '#484f58', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              App demo
            </button>
            <Link href="/privacy" style={{ fontSize: 11, color: '#484f58', textDecoration: 'none' }}>
              Privacy
            </Link>
            <Link href="/terms" style={{ fontSize: 11, color: '#484f58', textDecoration: 'none' }}>
              Terms
            </Link>
            <Link href="/docs" style={{ fontSize: 11, color: '#484f58', textDecoration: 'none' }}>
              Docs
            </Link>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: LANDING_PAGE_CSS }} />
    </div>
  )
}
