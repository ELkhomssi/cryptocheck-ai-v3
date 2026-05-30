'use client'

import { useEffect, useRef, useState } from 'react'
import { Radio, TrendingUp, Eye, Clock } from 'lucide-react'
import { RiskGatedSwapPanel } from '@/components/trading/RiskGatedSwapPanel'
import type { TradeSignal } from '@/lib/trading/signal-trade-bridge'

const DEFAULT_TRADE_USD_KEY = 'ccai_default_trade_usd'
const MAX_VISIBLE = 25

type Props = {
  /** When true, render blurred teaser (free tier). */
  locked?: boolean
  filter?: { chain?: string; type?: 'BUY' | 'WATCH'; minConfidence?: number }
}

function defaultTradeUsd(): number {
  if (typeof window === 'undefined') return 50
  const raw = window.localStorage.getItem(DEFAULT_TRADE_USD_KEY)
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 50
}

function minutesLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.round(ms / 60_000))
}

export function SignalAlertFeed({ locked = false, filter }: Props) {
  const [signals, setSignals] = useState<TradeSignal[]>([])
  const [connected, setConnected] = useState(false)
  const [openMint, setOpenMint] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (locked) return
    const params = new URLSearchParams()
    if (filter?.chain) params.set('chain', filter.chain)
    if (filter?.type) params.set('type', filter.type)
    if (filter?.minConfidence) params.set('minConfidence', String(filter.minConfidence))
    const url = `/api/trading/signals${params.toString() ? `?${params.toString()}` : ''}`

    const es = new EventSource(url, { withCredentials: true })
    esRef.current = es
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as TradeSignal | { type: string }
        if ('type' in data && (data.type === 'ping' || data.type === 'connected')) return
        const sig = data as TradeSignal
        if (!sig.id || !sig.mint) return
        setSignals((prev) => {
          const next = [sig, ...prev.filter((s) => s.id !== sig.id)]
          return next.slice(0, MAX_VISIBLE)
        })
      } catch {
        /* ignore malformed frame */
      }
    }
    return () => {
      es.close()
      esRef.current = null
    }
  }, [locked, filter?.chain, filter?.type, filter?.minConfidence])

  if (locked) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <div className="pointer-events-none select-none space-y-3 blur-sm">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
              <div className="h-3 w-24 rounded bg-white/10" />
              <div className="mt-2 h-3 w-40 rounded bg-white/10" />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm font-semibold text-slate-200">Live trade signals</p>
          <a href="/pricing" className="rounded-lg bg-[#00d4aa] px-4 py-2 text-xs font-semibold text-slate-950">
            Upgrade to Pro to see live trade signals
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Radio className={`h-4 w-4 ${connected ? 'text-[#00d4aa]' : 'text-slate-500'}`} aria-hidden />
          Live trade signals
        </span>
        <span className="text-[0.6rem] uppercase tracking-wider text-slate-500">
          {connected ? 'streaming' : 'connecting…'}
        </span>
      </div>

      {signals.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">Waiting for signals…</p>
      ) : (
        <ul className="space-y-3">
          {signals.map((sig) => {
            const isBuy = sig.signalType === 'BUY'
            const left = minutesLeft(sig.expiresAt)
            return (
              <li key={sig.id} className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.65rem] font-bold ${
                      isBuy ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {isBuy ? <TrendingUp className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {sig.signalType}
                  </span>
                  <span className="font-mono text-[0.65rem] text-slate-400">
                    risk {sig.riskScore} · conf {sig.confidence}%
                  </span>
                </div>

                <p className="mt-2 break-all font-mono text-[0.7rem] text-slate-300">{sig.mint}</p>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-slate-400">
                  {sig.entryPriceUsd != null ? <span>Entry: ${sig.entryPriceUsd}</span> : null}
                  {sig.targetPriceUsd != null ? <span className="text-emerald-300">Target: +25%</span> : null}
                  {sig.stopLossPct != null ? <span className="text-rose-300">Stop: -{sig.stopLossPct}%</span> : null}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {left}m
                  </span>
                </div>

                {isBuy ? (
                  <button
                    onClick={() => setOpenMint(openMint === sig.mint ? null : sig.mint)}
                    className="mt-3 w-full rounded-lg bg-[#00d4aa] px-3 py-2 text-xs font-semibold text-slate-950 transition hover:brightness-105"
                  >
                    {openMint === sig.mint ? 'Close' : 'Trade now →'}
                  </button>
                ) : null}

                {openMint === sig.mint ? (
                  <div className="mt-3">
                    <RiskGatedSwapPanel defaultToToken={sig.mint} defaultAmountUsd={defaultTradeUsd()} />
                  </div>
                ) : null}

                <p className="mt-2 text-[0.55rem] leading-relaxed text-slate-600">
                  This is AI analysis only. Not financial advice. Trade at your own risk.
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
