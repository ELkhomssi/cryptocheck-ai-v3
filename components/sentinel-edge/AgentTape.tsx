'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Shield } from 'lucide-react'
import type { AgentFeedEvent, Decision, Settlement } from '@cryptocheck/signal-contracts'
import { EmptyState } from '@/components/command-center/EmptyState'
import { SkeletonRows } from '@/components/command-center/SkeletonRows'

export type TapeRow = {
  streamId: string
  event: AgentFeedEvent
  at: string
}

type Props = {
  tape: TapeRow[]
  recentIds: Set<string>
  loading?: boolean
  onVerify: (commitmentHash: string, decisionId: string, decision: Decision) => void
}

function explorerHref(tx?: string, url?: string): string | null {
  if (url) return url
  if (!tx || tx.startsWith('paper:')) return null
  return `https://explorer.solana.com/tx/${tx}`
}

function DecisionRow({
  decision,
  isRecent,
  onVerify,
  index,
}: {
  decision: Decision
  isRecent: boolean
  onVerify: () => void
  index: number
}) {
  const reduce = useReducedMotion()
  const proof = decision.proof
  const href = explorerHref(proof?.txSignature, proof?.explorerUrl)

  return (
    <motion.div
      layout={!reduce}
      initial={reduce || !isRecent ? false : { opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: isRecent ? 0 : Math.min(index, 6) * 0.02 }}
      className={`border-b border-white/[0.06] px-3 py-3 transition-colors hover:bg-white/[0.03] ${
        isRecent ? 'bg-rd-green/[0.06]' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-rd-display text-sm font-bold uppercase tracking-wide text-rd-hi">
              {decision.label ?? decision.matchId}
            </span>
            <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-rd-display text-[0.5rem] font-bold uppercase tracking-wider text-amber-200">
              {decision.side} · {decision.size}
            </span>
            <span className="rounded border border-rd-green/35 bg-rd-green/10 px-1.5 py-0.5 font-rd-mono text-[0.6rem] tabular-nums text-rd-green">
              edge {decision.edgeSignal.magnitude}
            </span>
            <span className="rounded border border-white/10 px-1.5 py-0.5 font-rd-display text-[0.5rem] font-bold uppercase tracking-wider text-rd-mid">
              {decision.mode}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-rd-mid">{decision.edgeSignal.rationale}</p>
          <p className="mt-1 font-rd-mono text-[0.6rem] tabular-nums text-rd-lo">
            {new Date(decision.timestamp).toLocaleTimeString()} · {decision.id.slice(0, 12)}…
            {proof?.commitmentHash ? ` · ${proof.commitmentHash.slice(0, 12)}…` : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-rd-green underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
            >
              Explorer
            </a>
          ) : (
            <span className="font-rd-display text-[0.5rem] font-bold uppercase tracking-wider text-rd-lo">
              {proof?.txSignature?.startsWith('paper:') ? 'Paper proof' : 'Indexed'}
            </span>
          )}
          <button
            type="button"
            disabled={!proof?.commitmentHash}
            onClick={onVerify}
            className="rounded-rd-sm border border-rd-green/40 bg-rd-green/10 px-2.5 py-1.5 font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-rd-green transition-colors hover:bg-rd-green/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/60 disabled:opacity-40"
          >
            Verify
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function SettlementRow({ settlement }: { settlement: Settlement }) {
  const href = explorerHref(settlement.proof?.txSignature, settlement.proof?.explorerUrl)
  const pnlAccent =
    settlement.realizedPnl > 0
      ? 'text-rd-safe'
      : settlement.realizedPnl < 0
        ? 'text-rd-danger'
        : 'text-rd-mid'

  return (
    <div className="border-b border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-rd-lo">
          Settlement · {settlement.outcome}
        </span>
        <span className={`font-rd-mono tabular-nums ${pnlAccent}`}>
          {settlement.realizedPnl >= 0 ? '+' : ''}
          {settlement.realizedPnl.toFixed(2)}
        </span>
      </div>
      <p className="mt-0.5 font-rd-mono text-[0.6rem] tabular-nums text-rd-lo">
        {settlement.decisionId.slice(0, 14)}…
        {href ? (
          <>
            {' · '}
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-rd-green hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
            >
              proof
            </a>
          </>
        ) : null}
      </p>
    </div>
  )
}

export function AgentTape({ tape, recentIds, loading, onVerify }: Props) {
  if (loading && !tape.length) {
    return <SkeletonRows rows={7} className="max-h-[min(70vh,560px)]" />
  }

  if (!tape.length) {
    return (
      <EmptyState
        icon={Shield}
        title="Awaiting first decision"
        detail="When the agent clears thresholds on a match event, commitments appear here — ready to verify."
      />
    )
  }

  return (
    <div className="rd-panel max-h-[min(70vh,560px)] overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-rd-navy2/95 px-3 py-2 backdrop-blur">
        <p className="rd-label">Live agent tape</p>
      </div>
      {tape.map((row, index) => {
        if (row.event.type === 'agent.decision') {
          const d = row.event.decision
          return (
            <DecisionRow
              key={row.streamId}
              decision={d}
              isRecent={recentIds.has(d.id)}
              index={index}
              onVerify={() => {
                if (d.proof?.commitmentHash) onVerify(d.proof.commitmentHash, d.id, d)
              }}
            />
          )
        }
        if (row.event.type === 'agent.settlement') {
          return <SettlementRow key={row.streamId} settlement={row.event.settlement} />
        }
        return (
          <div
            key={row.streamId}
            className="border-b border-white/[0.06] px-3 py-2 text-xs text-rd-caution"
          >
            Stand-down: {row.event.standDown.reason}
          </div>
        )
      })}
    </div>
  )
}
