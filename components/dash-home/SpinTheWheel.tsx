'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  SPIN_PRIZES,
  msUntilNextSpin,
  prizeIndex,
  type SpinPrize,
} from '@/lib/dashboard/spin-wheel'

type SpinStatus = {
  authenticated: boolean
  canSpin: boolean
  lastSpinDate: string | null
  nextSpinAt: string | null
  msUntilNext: number
  credits: number | null
  error?: string
  code?: string
  prize?: SpinPrize
  ok?: boolean
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ready'
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

async function signInWithGoogle() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.cryptocheckai.com'
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/dashboard')}`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
  if (error) throw error
}

export function SpinTheWheel() {
  const [status, setStatus] = useState<SpinStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<SpinPrize | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/dashboard/spin-wheel', { cache: 'no-store', credentials: 'include' })
      const j = (await r.json()) as SpinStatus
      setStatus(j)
      setError(null)
    } catch {
      setStatus({
        authenticated: false,
        canSpin: false,
        lastSpinDate: null,
        nextSpinAt: null,
        msUntilNext: 0,
        credits: null,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Unlock automatically after successful sign-in (session appears without full navigation).
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        void refresh()
      }
      if (event === 'SIGNED_OUT') {
        setResult(null)
        void refresh()
      }
    })
    return () => subscription.unsubscribe()
  }, [refresh])

  useEffect(() => {
    if (!status?.authenticated || status.canSpin) return
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [status?.authenticated, status?.canSpin])

  const locked = !status?.authenticated
  const cooldownMs = status?.lastSpinDate ? msUntilNextSpin(status.lastSpinDate, nowTick) : 0
  const onCooldown = Boolean(status?.authenticated && !status.canSpin && cooldownMs > 0)

  const segmentAngle = 360 / SPIN_PRIZES.length
  const conic = useMemo(() => {
    const stops = SPIN_PRIZES.map((p, i) => {
      const start = i * segmentAngle
      const end = (i + 1) * segmentAngle
      return `${p.color} ${start}deg ${end}deg`
    })
    return `conic-gradient(from -90deg, ${stops.join(', ')})`
  }, [segmentAngle])

  const handleSignIn = async () => {
    setAuthBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed')
      setAuthBusy(false)
    }
  }

  const handleSpin = async () => {
    if (locked) {
      void handleSignIn()
      return
    }
    if (onCooldown || spinning || !status?.canSpin) return

    setSpinning(true)
    setResult(null)
    setError(null)

    try {
      const r = await fetch('/api/dashboard/spin-wheel', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      })
      const j = (await r.json()) as SpinStatus & { prize?: SpinPrize; error?: string }

      if (!r.ok || !j.prize) {
        setError(j.error ?? 'Spin failed')
        setStatus((prev) => ({ ...(prev ?? j), ...j, authenticated: true }))
        setSpinning(false)
        return
      }

      const idx = prizeIndex(j.prize.id)
      // Land pointer at top (-90deg start) on the chosen segment center.
      const target =
        360 * 5 + (360 - (idx * segmentAngle + segmentAngle / 2))
      setRotation((prev) => prev + target)

      window.setTimeout(() => {
        setResult(j.prize!)
        setStatus({
          authenticated: true,
          canSpin: false,
          lastSpinDate: j.lastSpinDate ?? new Date().toISOString(),
          nextSpinAt: j.nextSpinAt ?? null,
          msUntilNext: j.msUntilNext ?? SPIN_COOLDOWN_FALLBACK,
          credits: j.credits ?? null,
        })
        setSpinning(false)
      }, 4200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Spin failed')
      setSpinning(false)
    }
  }

  return (
    <section className="dash-glass relative overflow-hidden rounded-dash border border-dash-hairline p-4 md:p-5">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-space text-[13px] font-semibold tracking-wide text-dash-green">
            Spin the Wheel
          </p>
          <p className="text-[11px] text-dash-tmid">Daily alpha drop · 1 spin / 24h</p>
        </div>
        {status?.authenticated && typeof status.credits === 'number' ? (
          <span className="font-dash-mono rounded-dash-chip border border-dash-innerline px-2 py-1 text-[10px] text-dash-tlo">
            {status.credits} credits
          </span>
        ) : null}
      </header>

      <div className="relative mx-auto w-full max-w-[240px]">
        {/* Pointer */}
        <div
          className="absolute left-1/2 top-0 z-20 h-0 w-0 -translate-x-1/2 -translate-y-0.5"
          style={{
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '14px solid #22C55E',
            filter: 'drop-shadow(0 0 8px rgba(34,197,94,0.55))',
          }}
          aria-hidden
        />

        <button
          type="button"
          onClick={() => void (locked ? handleSignIn() : handleSpin())}
          disabled={spinning || authBusy || loading}
          className="group relative mx-auto block aspect-square w-full rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
          aria-label={locked ? 'Sign in to spin' : onCooldown ? 'Spin on cooldown' : 'Spin the wheel'}
        >
          <div
            className={`absolute inset-0 rounded-full border-2 border-dash-green/40 transition-[filter,transform] duration-[4200ms] ease-out ${
              locked ? 'scale-[0.98] blur-[2.5px] brightness-75' : ''
            }`}
            style={{
              background: conic,
              transform: `rotate(${rotation}deg)`,
              boxShadow: '0 0 32px rgba(34,197,94,0.2), inset 0 0 24px rgba(0,0,0,0.35)',
            }}
          />
          {/* Segment labels (static relative to wheel) */}
          <div
            className={`pointer-events-none absolute inset-0 transition-[filter] duration-300 ${
              locked ? 'blur-[2px] opacity-70' : ''
            }`}
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {SPIN_PRIZES.map((p, i) => {
              const mid = i * segmentAngle + segmentAngle / 2 - 90
              return (
                <span
                  key={p.id + String(i)}
                  className="absolute left-1/2 top-1/2 origin-center text-[8px] font-bold uppercase tracking-wide text-black/80"
                  style={{
                    transform: `rotate(${mid}deg) translate(0, -78px) rotate(${-mid}deg)`,
                  }}
                >
                  {p.credits > 0 ? `+${p.credits}` : '·'}
                </span>
              )
            })}
          </div>

          <div className="absolute inset-[28%] z-10 flex flex-col items-center justify-center rounded-full border border-dash-hairline bg-dash-bg shadow-[0_0_24px_rgba(0,0,0,0.65)]">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-dash-green" />
            ) : locked ? (
              <>
                <Lock className="mb-1 h-5 w-5 text-dash-gold" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-dash-tlo">Locked</span>
              </>
            ) : spinning ? (
              <Loader2 className="h-5 w-5 animate-spin text-dash-green" />
            ) : onCooldown ? (
              <span className="font-dash-mono px-2 text-center text-[10px] text-dash-tmid">
                {formatCountdown(cooldownMs)}
              </span>
            ) : (
              <span className="text-[11px] font-bold uppercase tracking-wider text-dash-green">Spin</span>
            )}
          </div>

          {locked ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center rounded-full bg-black/25">
              <span className="rounded-full border border-dash-gold/40 bg-dash-bg/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-dash-gold shadow-[0_0_20px_rgba(249,115,22,0.25)]">
                <Lock className="mr-1 inline h-3 w-3" />
                Sign in required
              </span>
            </div>
          ) : null}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {locked ? (
          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={authBusy}
            className="w-full rounded-dash-chip bg-dash-green py-2.5 text-xs font-bold uppercase tracking-wider text-dash-bg noro-glow-green transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
          >
            {authBusy ? 'Redirecting…' : 'Sign in to Spin'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSpin()}
            disabled={spinning || onCooldown || !status?.canSpin}
            className="w-full rounded-dash-chip bg-dash-green py-2.5 text-xs font-bold uppercase tracking-wider text-dash-bg noro-glow-green transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {spinning ? 'Spinning…' : onCooldown ? `Next spin in ${formatCountdown(cooldownMs)}` : 'Spin'}
          </button>
        )}

        {result ? (
          <p className="rounded-dash-inner border border-dash-green/30 bg-dash-green/10 px-3 py-2 text-center text-xs text-dash-green">
            You won <span className="font-semibold">{result.label}</span>
            {result.credits > 0 ? ` · +${result.credits} credit${result.credits === 1 ? '' : 's'}` : ''}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-dash-inner border border-dash-red/30 bg-dash-red/10 px-3 py-2 text-center text-xs text-dash-red">
            {error}
          </p>
        ) : null}

        <p className="text-center text-[10px] text-dash-tlo">
          Non-custodial · informational rewards · not financial advice
        </p>
      </div>
    </section>
  )
}

const SPIN_COOLDOWN_FALLBACK = 24 * 60 * 60 * 1000
