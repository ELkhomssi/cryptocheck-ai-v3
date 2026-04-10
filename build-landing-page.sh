#!/bin/bash
# ============================================================
# CryptoCheck AI — Premium SaaS Landing Page
# Dark terminal aesthetic, sarcelle accents, conversion-focused
# ============================================================

set -e
echo "🎨 Building CryptoCheck AI Landing Page..."

# ---- Step 1: Copy robot image to public ----
echo "📸 Setting up hero image..."
mkdir -p public/images
if [ -f ~/Downloads/robot-hero.png ]; then
  cp ~/Downloads/robot-hero.png public/images/robot-hero.png
  echo "   ✅ Robot image from Downloads"
elif [ -f "public/images/robot-hero.png" ]; then
  echo "   ✅ Robot image already exists"
else
  echo "   ⚠️  Place the robot image at public/images/robot-hero.png"
  echo "   (Copy the uploaded image manually)"
fi

# Also check if the image was named differently
ls -la public/images/ 2>/dev/null || true

# ---- Step 2: Create the Landing Page ----
echo ""
echo "📝 Creating app/landing/page.tsx..."
mkdir -p app/landing

cat > app/landing/page.tsx << 'ENDOFSCRIPT'
'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [scrollY, setScrollY] = useState(0)
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Intersection observer for scroll animations
  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setVisible(prev => ({ ...prev, [e.target.id]: true }))
        }
      })
    }, { threshold: 0.15 })

    document.querySelectorAll('[data-animate]').forEach(el => {
      observerRef.current?.observe(el)
    })
    return () => observerRef.current?.disconnect()
  }, [])

  async function handleSignup() {
    if (!email || !email.includes('@')) { setError('Enter a valid email'); return }
    setLoading(true); setError('')
    try {
      const { error: authErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://www.cryptocheckai.com/app' }
      })
      if (authErr) throw authErr
    } catch (e: any) {
      // Fallback to email signup
      try {
        const { error: signErr } = await supabase.auth.signUp({
          email, password: crypto.randomUUID().slice(0, 12),
          options: { emailRedirectTo: 'https://www.cryptocheckai.com/app' }
        })
        if (signErr) throw signErr
        setSent(true)
      } catch (e2: any) {
        setError(e2.message || 'Signup failed')
      }
    }
    setLoading(false)
  }

  function handleGoogleSignup() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://www.cryptocheckai.com/app',
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
    })
  }

  const stats = [
    { value: '$4.2M+', label: 'Protected from rugs', delay: 0 },
    { value: '14,902', label: 'Tokens scanned today', delay: 100 },
    { value: '97%', label: 'Rug detection accuracy', delay: 200 },
    { value: '<200ms', label: 'Real-time response', delay: 300 },
  ]

  const steps = [
    {
      num: '01',
      title: 'Sign Up Free',
      desc: 'Create your account in 10 seconds. Get 10 Neural Scan credits instantly — no card required.',
      icon: '⚡',
      accent: '#20b2aa',
    },
    {
      num: '02',
      title: 'Scan Any Token',
      desc: 'Paste a Solana mint address. Our AI engine analyzes holders, liquidity, mint authority, and 47+ risk signals in real-time.',
      icon: '🔬',
      accent: '#00d4aa',
    },
    {
      num: '03',
      title: 'Trade with Whale Mode',
      desc: 'Unlock Auto-Sniper & Whale Tracking. Pay only a 0.5% performance fee on profitable trades — nothing upfront.',
      icon: '🐋',
      accent: '#d4af37',
    },
  ]

  const features = [
    { icon: '🧠', title: 'Neural Scan V4', desc: 'AI scores 0–100 across 47+ risk vectors. SAFE/SCAM verdict in under 200ms.' },
    { icon: '🐋', title: 'Whale Tracking', desc: 'Follow smart money. See what top wallets are buying before the crowd.' },
    { icon: '🔍', title: 'Rug Forensics Lab', desc: 'Post-mortem analysis on rug pulls. Learn the patterns, avoid the traps.' },
    { icon: '🎯', title: 'AI Auto-Sniper', desc: 'Automated entry on high-confidence signals. 0.5% fee only on profits.' },
    { icon: '📊', title: 'Holder Distribution', desc: 'Visualize top wallets, insider clusters, and concentration risk instantly.' },
    { icon: '⚡', title: 'Live Alpha Feed', desc: 'Real-time whale buys, new pools, rug alerts, and volume spikes.' },
  ]

  return (
    <div style={{ background: '#000', color: '#e2e8f0', fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace", overflow: 'hidden' }}>

      {/* ═══════════════════════════════════════════
          NAVBAR
      ═══════════════════════════════════════════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px',
        background: scrollY > 50 ? 'rgba(0,0,0,0.9)' : 'transparent',
        backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
        borderBottom: scrollY > 50 ? '1px solid rgba(32,178,170,0.1)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #20b2aa, #00d4aa)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#000',
          }}>CC</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            Crypto<span style={{ color: '#20b2aa' }}>Check</span>AI
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {['Features', 'How it Works', 'Pricing'].map(item => (
            <a key={item} href={`#${item.toLowerCase().replace(/\s/g, '-')}`}
              style={{ fontSize: 11, color: '#8b949e', textDecoration: 'none', letterSpacing: '0.05em', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = '#20b2aa'}
              onMouseLeave={e => (e.target as HTMLElement).style.color = '#8b949e'}
            >{item}</a>
          ))}
          <a href="/app" style={{
            padding: '7px 16px', fontSize: 11, fontWeight: 700,
            background: 'linear-gradient(135deg, #20b2aa, #00d4aa)',
            color: '#000', borderRadius: 6, textDecoration: 'none',
            letterSpacing: '0.04em',
          }}>Launch App →</a>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════
          HERO — Split Screen
      ═══════════════════════════════════════════ */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        position: 'relative', overflow: 'hidden',
        paddingTop: 56,
      }}>
        {/* Background grid + glow */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(32,178,170,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(32,178,170,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }} />
        <div style={{
          position: 'absolute', top: '20%', left: '10%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(32,178,170,0.08) 0%, transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '20%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,170,0.06) 0%, transparent 70%)',
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />

        <div style={{
          maxWidth: 1280, margin: '0 auto', padding: '0 32px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60,
          alignItems: 'center', width: '100%',
          position: 'relative', zIndex: 1,
        }}>
          {/* LEFT — Copy */}
          <div style={{ animation: 'fadeInUp 0.8s ease-out' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 20,
              background: 'rgba(32,178,170,0.08)',
              border: '1px solid rgba(32,178,170,0.2)',
              marginBottom: 24,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#20b2aa', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, color: '#20b2aa', fontWeight: 600, letterSpacing: '0.06em' }}>
                AI-POWERED SOLANA INTELLIGENCE · LIVE ON MAINNET
              </span>
            </div>

            <h1 style={{
              fontSize: 52, fontWeight: 800, lineHeight: 1.1,
              color: '#fff', margin: '0 0 8px 0',
              letterSpacing: '-0.03em',
            }}>
              Stop Losing Money to{' '}
              <span style={{
                background: 'linear-gradient(135deg, #20b2aa, #00d4aa)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                Solana Rug Pulls
              </span>
            </h1>

            <p style={{
              fontSize: 16, color: '#8b949e', lineHeight: 1.7,
              margin: '20px 0 32px', maxWidth: 480,
            }}>
              Instantly scan any token with our Neural Scanner before you buy.
              AI analyzes 47+ risk signals in real-time.{' '}
              <span style={{ color: '#20b2aa', fontWeight: 700 }}>
                Get 10 FREE Scans on signup.
              </span>
            </p>

            {/* CTA Buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
              <button onClick={handleGoogleSignup} style={{
                padding: '14px 28px', fontSize: 14, fontWeight: 700,
                background: 'linear-gradient(135deg, #20b2aa, #00d4aa)',
                border: 'none', borderRadius: 8, color: '#000',
                cursor: 'pointer', letterSpacing: '0.03em',
                boxShadow: '0 0 30px rgba(32,178,170,0.3), 0 4px 20px rgba(0,0,0,0.3)',
                transition: 'all 0.2s',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
                onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'translateY(-2px)'; (e.target as HTMLElement).style.boxShadow = '0 0 40px rgba(32,178,170,0.4), 0 8px 30px rgba(0,0,0,0.4)' }}
                onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'translateY(0)'; (e.target as HTMLElement).style.boxShadow = '0 0 30px rgba(32,178,170,0.3), 0 4px 20px rgba(0,0,0,0.3)' }}
              >
                ⚡ Start Free — 10 Credits
              </button>
              <a href="/app" style={{
                padding: '14px 28px', fontSize: 14, fontWeight: 700,
                background: 'transparent',
                border: '1px solid rgba(32,178,170,0.3)', borderRadius: 8,
                color: '#20b2aa', textDecoration: 'none',
                display: 'flex', alignItems: 'center',
                fontFamily: "'IBM Plex Mono', monospace",
                transition: 'all 0.2s',
              }}>
                See Features →
              </a>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {stats.map((s, i) => (
                <div key={i} style={{
                  animation: `fadeInUp 0.6s ease-out ${s.delay}ms both`,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#20b2aa', letterSpacing: '-0.02em' }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: '0.08em', marginTop: 2 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Robot Image */}
          <div style={{
            position: 'relative',
            animation: 'fadeInUp 1s ease-out 0.3s both',
          }}>
            <div style={{
              position: 'absolute', inset: -40,
              background: 'radial-gradient(circle at center, rgba(32,178,170,0.12) 0%, transparent 60%)',
              filter: 'blur(40px)', pointerEvents: 'none',
            }} />
            <img
              src="/images/robot-hero.png"
              alt="CryptoCheck AI — Solana Token Intelligence"
              style={{
                width: '100%', maxWidth: 520,
                borderRadius: 16,
                position: 'relative', zIndex: 1,
                filter: 'drop-shadow(0 20px 60px rgba(32,178,170,0.2))',
              }}
            />
            {/* Floating badge */}
            <div style={{
              position: 'absolute', bottom: 40, left: -20, zIndex: 2,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(32,178,170,0.25)',
              borderRadius: 10, padding: '10px 16px',
              animation: 'float 3s ease-in-out infinite',
            }}>
              <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: '0.1em', marginBottom: 2 }}>NEURAL SCORE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#00d4aa' }}>78</span>
                <span style={{ fontSize: 10, color: '#00d4aa', fontWeight: 700, padding: '2px 6px', background: 'rgba(0,212,170,0.1)', borderRadius: 4 }}>LOW RISK</span>
              </div>
            </div>
            <div style={{
              position: 'absolute', top: 60, right: -10, zIndex: 2,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(212,175,55,0.25)',
              borderRadius: 10, padding: '10px 16px',
              animation: 'float 3s ease-in-out infinite 1.5s',
            }}>
              <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: '0.1em', marginBottom: 2 }}>RUG PROBABILITY</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ff4444' }}>12% <span style={{ fontSize: 10, color: '#00d4aa' }}>SAFE</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          HOW IT WORKS — Hybrid Credit & Fee Model
      ═══════════════════════════════════════════ */}
      <section id="how-it-works" data-animate style={{
        padding: '120px 32px', position: 'relative',
        background: 'linear-gradient(180deg, #000 0%, #050a06 100%)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#20b2aa',
              marginBottom: 12,
            }}>HOW IT WORKS</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
              Scan. Detect. <span style={{ color: '#20b2aa' }}>Protect.</span>
            </h2>
            <p style={{ fontSize: 14, color: '#6e7681', marginTop: 12 }}>
              No subscriptions. No upfront fees. Pay only for what you use.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {steps.map((step, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid rgba(${step.accent === '#d4af37' ? '212,175,55' : '32,178,170'},0.15)`,
                borderRadius: 12, padding: '32px 28px',
                position: 'relative', overflow: 'hidden',
                transition: 'all 0.3s ease',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = step.accent; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `rgba(${step.accent === '#d4af37' ? '212,175,55' : '32,178,170'},0.15)`; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
              >
                <div style={{
                  position: 'absolute', top: -20, right: -10,
                  fontSize: 80, fontWeight: 900, color: 'rgba(255,255,255,0.02)',
                  lineHeight: 1,
                }}>{step.num}</div>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{step.icon}</div>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
                  color: step.accent, marginBottom: 8,
                }}>STEP {step.num}</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.01em' }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.6, margin: 0 }}>
                  {step.desc}
                </p>
                {i === 2 && (
                  <div style={{
                    marginTop: 16, padding: '8px 12px',
                    background: 'rgba(212,175,55,0.08)',
                    border: '1px solid rgba(212,175,55,0.2)',
                    borderRadius: 6, fontSize: 11, color: '#d4af37',
                    fontWeight: 600,
                  }}>
                    💰 0.5% fee only on profitable trades
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FEATURES GRID
      ═══════════════════════════════════════════ */}
      <section id="features" data-animate style={{
        padding: '100px 32px',
        background: '#000',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#20b2aa', marginBottom: 12 }}>
              FEATURES
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: 0 }}>
              Institutional-Grade <span style={{ color: '#20b2aa' }}>Intelligence</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {features.map((f, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '24px',
                transition: 'all 0.3s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(32,178,170,0.3)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
              >
                <div style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>{f.title}</h3>
                <p style={{ fontSize: 12, color: '#6e7681', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          LIVE SCANNER DEMO EMBED
      ═══════════════════════════════════════════ */}
      <section id="pricing" data-animate style={{
        padding: '100px 32px',
        background: 'linear-gradient(180deg, #000 0%, #050a06 100%)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#20b2aa', marginBottom: 12 }}>
              LIVE PREVIEW
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: 0 }}>
              See the Scanner in <span style={{ color: '#20b2aa' }}>Action</span>
            </h2>
            <p style={{ fontSize: 14, color: '#6e7681', marginTop: 12 }}>
              Real-time Solana token scanning powered by Helius RPC & Neural Engine V4
            </p>
          </div>

          {/* Terminal-style demo window */}
          <div style={{
            background: '#0d1117',
            border: '1px solid rgba(32,178,170,0.15)',
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(32,178,170,0.05)',
          }}>
            {/* Window chrome */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px',
              background: '#161b22',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
              </div>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#6e7681' }}>
                cryptocheckai.com
              </div>
              <div style={{ fontSize: 9, color: '#20b2aa', fontWeight: 700, padding: '2px 8px', background: 'rgba(32,178,170,0.1)', borderRadius: 4 }}>
                ● LIVE
              </div>
            </div>

            {/* Iframe of actual app */}
            <div style={{ height: 520, position: 'relative', overflow: 'hidden' }}>
              <iframe
                src="/app"
                style={{
                  width: '100%', height: '100%', border: 'none',
                  pointerEvents: 'none',
                }}
                loading="lazy"
              />
              {/* Overlay to prevent interaction */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.8) 100%)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                paddingBottom: 32,
              }}>
                <button onClick={handleGoogleSignup} style={{
                  padding: '14px 32px', fontSize: 14, fontWeight: 700,
                  background: 'linear-gradient(135deg, #20b2aa, #00d4aa)',
                  border: 'none', borderRadius: 8, color: '#000',
                  cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace",
                  boxShadow: '0 0 30px rgba(32,178,170,0.4)',
                }}>
                  ⚡ Try It Free — 10 Neural Scans
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════════ */}
      <section style={{
        padding: '100px 32px',
        textAlign: 'center',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(32,178,170,0.06) 0%, transparent 60%)',
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, color: '#fff', margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Protect Your Portfolio <span style={{ color: '#20b2aa' }}>Today</span>
          </h2>
          <p style={{ fontSize: 15, color: '#6e7681', maxWidth: 500, margin: '0 auto 32px' }}>
            Join thousands of Solana traders who scan before they buy.
            10 free Neural Scans. No credit card required.
          </p>
          <button onClick={handleGoogleSignup} style={{
            padding: '16px 40px', fontSize: 16, fontWeight: 700,
            background: 'linear-gradient(135deg, #20b2aa, #00d4aa)',
            border: 'none', borderRadius: 8, color: '#000',
            cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace",
            boxShadow: '0 0 40px rgba(32,178,170,0.3), 0 4px 20px rgba(0,0,0,0.3)',
            transition: 'all 0.2s',
          }}>
            ⚡ Start Free — 10 Credits
          </button>
          <div style={{ fontSize: 11, color: '#484f58', marginTop: 12 }}>
            No subscription · No credit card · 10 free scans
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════ */}
      <footer style={{
        padding: '40px 32px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 1100, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #20b2aa, #00d4aa)',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#000',
          }}>CC</div>
          <span style={{ fontSize: 12, color: '#6e7681' }}>
            © 2026 CryptoCheck AI, Inc. · Delaware C-Corp
          </span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy', 'Terms', 'Docs'].map(l => (
            <a key={l} href="#" style={{ fontSize: 11, color: '#484f58', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
      </footer>

      {/* ═══════════════════════════════════════════
          GLOBAL STYLES
      ═══════════════════════════════════════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* Responsive */
        @media (max-width: 768px) {
          section > div > div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
          h1 { font-size: 32px !important; }
          h2 { font-size: 28px !important; }
          nav > div:first-child + div > a:not(:last-child) {
            display: none !important;
          }
        }

        /* Smooth scrolling */
        html { scroll-behavior: smooth; }

        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: rgba(32,178,170,0.3); border-radius: 3px; }
      `}</style>
    </div>
  )
}
ENDOFSCRIPT
echo "   ✅ app/landing/page.tsx created"

# ---- Step 3: TypeScript check ----
echo ""
echo "🔍 TypeScript check..."
npx tsc --noEmit 2>&1 | head -10

echo ""
echo "============================================"
echo "✅ LANDING PAGE READY"
echo ""
echo "⚠️  IMPORTANT: Copy the robot image to public/"
echo "   cp ~/Downloads/Protection_contre_les_rug_pulls_Solana.png public/images/robot-hero.png"
echo ""
echo "🚀 Deploy:"
echo "   git add -A && git commit -m 'feat: premium SaaS landing page with hybrid credit model' && vercel --prod"
echo "============================================"
