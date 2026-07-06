'use client'

import Link from 'next/link'
import type { Decision } from '@cryptocheck/signal-contracts'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { formatAge } from '@/lib/signals-dashboard/format'
import { SkeletonBlock } from './primitives/SkeletonBlock'

export type MatchCardProps = {
  match: UnifiedSignal
  decision?: Decision
}

function explorerHref(tx?: string, url?: string): string | null {
  if (url) return url
  if (!tx || tx.startsWith('paper:')) return null
  return `https://explorer.solana.com/tx/${tx}`
}

export function MatchCard({ match, decision }: MatchCardProps) {
  const teams = match.teams ? `${match.teams.home} vs ${match.teams.away}` : match.label
  const proofHref = decision?.proof
    ? explorerHref(decision.proof.txSignature, decision.proof.explorerUrl)
    : null
  const edge = match.edgeSignal

  return (
    <article className="min-w-[240px] shrink-0 rounded-dash-inner border border-dash-innerline bg-dash-panel2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-dash-chip border border-dash-orangeTx/40 bg-dash-orangeTx/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-dash-orangeTx">
          TxODDS
        </span>
        <span className="font-dash-mono text-[10px] text-dash-tlo">{formatAge(match.msgTimestamp)}</span>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-dash-thi">{teams}</p>
      {match.score ? (
        <p className="font-dash-mono mt-1 text-sm text-dash-tmid">
          {match.score.home} – {match.score.away}
        </p>
      ) : null}
      {typeof match.value === 'number' ? (
        <p className="font-dash-mono mt-1 text-[11px] text-dash-tmid">
          {match.market ?? 'Odds'} · {match.value.toFixed(2)}
        </p>
      ) : null}
      {edge && edge.magnitude >= 35 ? (
        <p className="mt-2 rounded-dash-chip bg-dash-greenDim px-2 py-1 text-[11px] text-dash-green">
          EDGE {Math.round(edge.magnitude)}% · {edge.rationale.slice(0, 48)}
        </p>
      ) : null}
      {proofHref ? (
        <a
          href={proofHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex text-[10px] font-semibold text-dash-green hover:underline"
        >
          on-chain proof ↗
        </a>
      ) : null}
    </article>
  )
}

export type TxOddsLivePanelProps = {
  matches: UnifiedSignal[]
  decisionsByMatch: Map<string, Decision>
  loading: boolean
}

export function TxOddsLivePanel({ matches, decisionsByMatch, loading }: TxOddsLivePanelProps) {
  return (
    <section className="rounded-dash border border-dash-hairline bg-dash-panel p-4 md:p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-dash-orangeTx" />
          <p className="text-[13px] font-semibold text-dash-orangeTx">TXODDS LIVE MATCHES · SENTINEL EDGE</p>
        </div>
        <Link href="/dashboard/signals/agent" className="text-xs font-semibold text-dash-green hover:underline">
          View agent →
        </Link>
      </header>
      <p className="mb-3 text-[11px] text-dash-tlo">Sports signals informational only — not swap recommendations</p>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-32 min-w-[240px] shrink-0" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <p className="rounded-dash-inner border border-dashed border-dash-innerline py-8 text-center text-xs text-dash-tmid">
          No live matches — awaiting next kickoff
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {matches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              decision={m.matchId ? decisionsByMatch.get(m.matchId) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}
