'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import LandingPageClient from '@/components/landing/LandingPageClient'
import type { LandingPublicStats } from '@/lib/landing/types'

const CLIENT_FALLBACK_STATS: LandingPublicStats = {
  stats: [
    { value: '—', label: 'Live stats', note: 'building in public' },
    { value: 'Fast', label: 'Explainable verdicts', note: 'latency not published yet' },
  ],
  asOfIso: new Date(0).toISOString(),
  asOfLabel: '—',
  heroScan: null,
  buildingInPublic: true,
}

export default function RootWrapper({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'guest' | 'user'>('loading')

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session?.user ? 'user' : 'guest')
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setStatus(session?.user ? 'user' : 'guest')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (status === 'loading')
    return (
      <div
        style={{
          background: '#050a06',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg,#34d399,#10b981)',
              borderRadius: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#050a06',
              margin: '0 auto 10px',
            }}
          >
            CC
          </div>
          <div style={{ fontSize: 11, color: '#34d399', fontFamily: 'IBM Plex Mono,monospace', letterSpacing: '0.1em' }}>
            LOADING...
          </div>
        </div>
        <style>{`@keyframes p{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      </div>
    )

  if (status === 'guest')
    return <LandingPageClient publicStats={CLIENT_FALLBACK_STATS} launchLabLive={false} />

  // Logged-in users still see the landing page at `/` (no auto-redirect to `/app`).
  if (typeof window !== 'undefined' && window.location.pathname === '/') {
    return <LandingPageClient publicStats={CLIENT_FALLBACK_STATS} launchLabLive={false} />
  }
  return <>{children}</>
}
