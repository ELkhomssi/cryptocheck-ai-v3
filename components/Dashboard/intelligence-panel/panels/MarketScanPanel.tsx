'use client'

import { useEffect, useMemo, useState } from 'react'
import { computeRisk, type ScanData } from '@/lib/helius'
import { GlassCard } from '../shared/GlassCard'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, CheckCircle2, Scale, ShieldAlert } from 'lucide-react'
import { motion } from 'framer-motion'

export function MarketScanPanel({ mint }: { mint: string }) {
  const [scan, setScan] = useState<ScanData | null>(null)
  const [tracking, setTracking] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      if (mint?.length < 32) {
        setScan(null)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await fetch('/api/solana/scan-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mint }),
        })
        const json = (await res.json()) as ScanData
        if (active && res.ok) setScan(json)
        else if (active) setScan(null)
      } catch {
        if (active) setScan(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [mint])

  const risk = scan ? computeRisk(scan) : null

  const verdictVisual = useMemo(() => {
    const v = (risk?.verdict ?? '').toUpperCase()
    if (v.includes('SAFE')) {
      return {
        Icon: CheckCircle2,
        gradient: 'from-emerald-400/30 via-cyan-500/20 to-emerald-500/25',
        border: 'border-emerald-400/45',
        glow: 'shadow-[0_0_48px_rgba(16,185,129,0.35),inset_0_1px_0_rgba(255,255,255,0.08)]',
        text: 'text-emerald-100',
        iconClass: 'text-emerald-300',
      }
    }
    if (v.includes('CAUTION') || v.includes('⚠')) {
      return {
        Icon: Scale,
        gradient: 'from-amber-400/25 via-fuchsia-500/15 to-cyan-500/20',
        border: 'border-amber-400/40',
        glow: 'shadow-[0_0_48px_rgba(245,158,11,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]',
        text: 'text-amber-50',
        iconClass: 'text-amber-300',
      }
    }
    if (v.includes('HIGH') || v.includes('AVOID') || v.includes('✕')) {
      return {
        Icon: ShieldAlert,
        gradient: 'from-rose-500/30 via-fuchsia-600/25 to-rose-900/30',
        border: 'border-rose-400/45',
        glow: 'shadow-[0_0_48px_rgba(244,63,94,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]',
        text: 'text-rose-50',
        iconClass: 'text-rose-300',
      }
    }
    return {
      Icon: AlertTriangle,
      gradient: 'from-cyan-500/20 via-slate-800/50 to-fuchsia-500/20',
      border: 'border-cyan-400/30',
      glow: 'shadow-[0_0_36px_rgba(34,211,238,0.15)]',
      text: 'text-slate-100',
      iconClass: 'text-cyan-300',
    }
  }, [risk?.verdict])

  const { Icon, gradient, border, glow, text, iconClass } = verdictVisual

  return (
    <GlassCard title="Market Scan" badge="Helius engine">
      <div className="space-y-4">
        <div className="font-mono-terminal text-sm font-semibold text-slate-300">
          <span className="text-slate-500">Mint · </span>
          {mint.length >= 12 ? `${mint.slice(0, 8)}…${mint.slice(-6)}` : mint || '—'}
        </div>
        <p className="text-sm leading-relaxed text-slate-400">
          On-chain scan only — no automated execution. Verdict reflects heuristics, not a guarantee.
        </p>

        <motion.div
          layout
          className={`
            relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br p-6 sm:p-7
            ${gradient} ${border} ${glow}
          `}
        >
          <motion.div
            className="pointer-events-none absolute -inset-px opacity-40"
            style={{
              background:
                'radial-gradient(circle at 30% 20%, rgba(34,211,238,0.25), transparent 45%), radial-gradient(circle at 70% 80%, rgba(168,85,247,0.2), transparent 40%)',
            }}
            animate={{ opacity: [0.25, 0.45, 0.25] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div
              className={`
              flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10
              bg-black/30 ${iconClass}
            `}
            >
              <Icon className="h-9 w-9 drop-shadow-[0_0_12px_currentColor]" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono-terminal text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                Institutional verdict
              </p>
              <p className={`mt-2 font-space text-xl font-bold leading-tight tracking-tight sm:text-2xl ${text}`}>
                {loading ? 'Scanning chain state…' : risk?.verdict ?? 'Awaiting scan data'}
              </p>
              {risk?.summary ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-200/90">{risk.summary}</p>
              ) : !loading ? (
                <p className="mt-3 text-sm text-slate-500">Run a valid mint to populate the verdict module.</p>
              ) : null}
            </div>
          </div>
        </motion.div>

        <button
          type="button"
          disabled={tracking || mint.length < 32}
          onClick={async () => {
            setTracking(true)
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser()
              if (!user) return
              await supabase
                .from('tracked_opportunities')
                .upsert({ user_id: user.id, mint }, { onConflict: 'user_id,mint' })
            } finally {
              setTracking(false)
            }
          }}
          className="
            w-full rounded-xl border border-cyan-400/35 bg-gradient-to-r from-cyan-500/15 via-fuchsia-500/10 to-emerald-500/15
            px-4 py-3 font-space text-sm font-bold uppercase tracking-widest text-cyan-100
            transition hover:from-cyan-500/25 hover:to-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40
          "
        >
          {tracking ? 'Recording…' : 'Track this token'}
        </button>
      </div>
    </GlassCard>
  )
}
