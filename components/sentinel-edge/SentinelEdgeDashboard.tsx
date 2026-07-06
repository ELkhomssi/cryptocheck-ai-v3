'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentControlState, Decision, VerifyResult } from '@cryptocheck/signal-contracts'
import { AGENT_COMPLIANCE, SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'
import type { ConnectionState } from '@/components/command-center/ConnectionPill'
import { ConnectionPill } from '@/components/command-center/ConnectionPill'
import { FeedErrorCard } from '@/components/command-center/FeedErrorCard'
import { AgentControls } from './AgentControls'
import { AgentTape, type TapeRow } from './AgentTape'
import { EdgeHero } from './EdgeHero'
import { TrackRecordPanel } from './TrackRecordPanel'
import { VerifyProofModal } from './VerifyProofModal'

type TrackSummary = {
  decisionsCount: number
  settlementsCount: number
  openCount: number
  totalPnl: number
  wins: number
  losses: number
  hitRate: number
  label: string
}

const defaultTrack: TrackSummary = {
  decisionsCount: 0,
  settlementsCount: 0,
  openCount: 0,
  totalPnl: 0,
  wins: 0,
  losses: 0,
  hitRate: 0,
  label: 'verifiable on-chain',
}

const POLL_MS = 2500
const BACKOFF_MAX = 12_000

export function SentinelEdgeDashboard() {
  const [control, setControl] = useState<AgentControlState | null>(null)
  const [track, setTrack] = useState<TrackSummary>(defaultTrack)
  const [backtest, setBacktest] = useState<Record<string, unknown> | null>(null)
  const [tape, setTape] = useState<TapeRow[]>([])
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set())
  const [hero, setHero] = useState<Decision | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [degraded, setDegraded] = useState(false)

  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifyDecision, setVerifyDecision] = useState<Decision | null>(null)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)

  const seenRef = useRef<Set<string>>(new Set())
  const failStreak = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadAll = useCallback(async (isRetry = false) => {
    if (isRetry) setConnection((c) => (c === 'live' ? 'reconnecting' : c))
    try {
      const [statusRes, tapeRes] = await Promise.all([
        fetch('/api/signals/agent/status', { cache: 'no-store' }),
        fetch('/api/signals/agent/tape?limit=50', { cache: 'no-store' }),
      ])
      const statusBody = await statusRes.json()
      const tapeBody = await tapeRes.json()

      if (!statusRes.ok || !tapeRes.ok) {
        throw new Error(statusBody.error ?? tapeBody.error ?? 'status')
      }

      setControl(statusBody.control)
      setTrack(statusBody.track ?? defaultTrack)
      setBacktest(statusBody.backtest ?? null)

      const next = (tapeBody.tape ?? []) as TapeRow[]
      const fresh: Decision[] = []
      for (const row of next) {
        if (row.event.type !== 'agent.decision') continue
        const d = row.event.decision
        if (!seenRef.current.has(d.id) && seenRef.current.size > 0) {
          fresh.push(d)
        }
        seenRef.current.add(d.id)
      }
      if (fresh.length) {
        const newest = fresh[0]!
        setHero(newest)
        setRecentIds((prev) => new Set([...prev, ...fresh.map((d) => d.id)]))
        window.setTimeout(() => {
          setRecentIds((prev) => {
            const n = new Set(prev)
            for (const d of fresh) n.delete(d.id)
            return n
          })
        }, 1400)
        window.setTimeout(() => {
          setHero((h) => (h?.id === newest.id ? null : h))
        }, 5200)
      }

      setTape(next)
      setConnection('live')
      setDegraded(false)
      failStreak.current = 0
      setLoading(false)
    } catch (e) {
      console.error('[SentinelEdge]', e)
      failStreak.current += 1
      setConnection(failStreak.current > 2 ? 'down' : 'reconnecting')
      setDegraded(true)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const schedule = (ms: number) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (cancelled) return
        void loadAll().finally(() => {
          if (cancelled) return
          const backoff = Math.min(
            POLL_MS * Math.max(1, failStreak.current),
            BACKOFF_MAX,
          )
          schedule(failStreak.current ? backoff : POLL_MS)
        })
      }, ms)
    }
    void loadAll().finally(() => {
      if (!cancelled) schedule(POLL_MS)
    })
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [loadAll])

  const onControlChange = useCallback(async (patch: Partial<AgentControlState>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/signals/agent/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'control')
      setControl(body.control)
    } catch (e) {
      console.error('[SentinelEdge] control', e)
      setDegraded(true)
    } finally {
      setSaving(false)
    }
  }, [])

  const openVerify = useCallback(async (commitmentHash: string, decision: Decision) => {
    setVerifyDecision(decision)
    setVerifyResult(null)
    setVerifyLoading(true)
    setVerifyOpen(true)
    try {
      const res = await fetch('/api/signals/agent/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitmentHash, decisionId: decision.id }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'verify')
      setVerifyResult(body.result as VerifyResult)
    } catch (e) {
      console.error('[SentinelEdge] verify', e)
      setVerifyResult({
        ok: false,
        commitmentHash,
        checks: {
          dataHashMatch: false,
          commitmentHashMatch: false,
          hmacValid: null,
          onChainMatch: null,
        },
        details: ['Verification could not complete'],
      })
    } finally {
      setVerifyLoading(false)
    }
  }, [])

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-rd-lime">
            Sentinel Edge
          </p>
          <h2 className="mt-1 font-rd-display text-xl font-bold uppercase tracking-[0.06em] text-rd-hi md:text-2xl">
            Autonomous verifiable agent
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-rd-mid">{AGENT_COMPLIANCE.label}</p>
          <p className="mt-1 max-w-2xl text-xs text-rd-lo">{AGENT_COMPLIANCE.disclaimer}</p>
        </div>
        <ConnectionPill
          state={connection}
          tier={control?.mode === 'live' ? 'LIVE' : 'PAPER'}
          delayLabel="poll 2.5s"
        />
      </header>

      <EdgeHero
        decision={hero}
        onDismiss={() => setHero(null)}
        onVerify={() => {
          if (hero?.proof?.commitmentHash) {
            void openVerify(hero.proof.commitmentHash, hero)
          }
        }}
      />

      {degraded && connection !== 'live' ? (
        <FeedErrorCard
          onRetry={() => {
            failStreak.current = 0
            setConnection('reconnecting')
            void loadAll(true)
          }}
        />
      ) : null}

      {control ? (
        <AgentControls
          control={control}
          saving={saving}
          connection={connection}
          onChange={(p) => void onControlChange(p)}
        />
      ) : (
        <div className="rd-panel h-28 motion-safe:animate-pulse bg-white/[0.02]" aria-busy />
      )}

      <TrackRecordPanel track={track} backtest={backtest} loading={loading && !control} />

      <AgentTape
        tape={tape}
        recentIds={recentIds}
        loading={loading}
        onVerify={(hash, _id, decision) => void openVerify(hash, decision)}
      />

      <footer className="text-xs text-rd-lo">
        <a href={SIGNAL_COMPLIANCE.termsPath} className="underline hover:text-rd-mid">
          Terms
        </a>
        {' · '}
        <a href={SIGNAL_COMPLIANCE.feeDisclosurePath} className="underline hover:text-rd-mid">
          Fee disclosure
        </a>
      </footer>

      <VerifyProofModal
        open={verifyOpen}
        decision={verifyDecision}
        result={verifyResult}
        loading={verifyLoading}
        onClose={() => setVerifyOpen(false)}
      />
    </div>
  )
}
