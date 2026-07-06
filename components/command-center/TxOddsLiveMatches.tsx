'use client'

import Link from 'next/link'
import type { Decision } from '@cryptocheck/signal-contracts'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { formatAge } from '@/lib/signals-dashboard/format'
import { EmptyState } from './EmptyState'

type Props = {
  matches: UnifiedSignal[]
  decisionsByMatch: Map<string, Decision>
  loading: boolean
}

function explorerHref(tx?: string, url?: string): string | null {
  if (url) return url
  if (!tx || tx.startsWith('paper:')) return null
  return `https://explorer.solana.com/tx/${tx}`
}

export function TxOddsLiveMatches({ matches, decisionsByMatch, loading }: Props) {
  return (
    <section className="cc-panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cc-inner)] px-4 py-3">
        <div>
          <p className="cc-label text-[var(--cc-orange)]">TxODDS Live Matches · Sentinel Edge</p>
          <p className="text-[0.65rem] text-[var(--cc-lo)]">
            Sports signals are informational only — not swap recommendations
          </p>
        </div>
        <Link href="/dashboard/signals/agent" className="text-xs font-semibold text-[var(--cc-green)] hover:underline">
          View agent →
        </Link>
      </header>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 min-w-[220px] flex-shrink-0 cc-panel-2 cc-shimmer" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <EmptyState
          title="No live matches"
          detail="TxODDS match events appear here when ingestion is connected. Next kickoff awaits schedule data."
          className="border-0 bg-transparent min-h-[8rem]"
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto p-4 pb-5">
          {matches.map((m) => {
            const teams = m.teams ? `${m.teams.home} vs ${m.teams.away}` : m.label
            const decision = m.matchId ? decisionsByMatch.get(m.matchId) : undefined
            const proofHref = decision?.proof
              ? explorerHref(decision.proof.txSignature, decision.proof.explorerUrl)
              : null
            const edge = m.edgeSignal

            return (
              <article
                key={m.id}
                className="cc-panel-2 min-w-[240px] flex-shrink-0 p-3 ring-1 ring-[var(--cc-orange)]/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded border border-[var(--cc-orange)]/40 bg-[var(--cc-orange)]/10 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase text-[var(--cc-orange)]">
                    TxODDS
                  </span>
                  <span className="cc-mono text-[0.58rem] text-[var(--cc-lo)]">{formatAge(m.msgTimestamp)}</span>
                </div>
                <p className="mt-2 font-semibold text-[var(--cc-hi)]">{teams}</p>
                {m.score ? (
                  <p className="cc-mono mt-1 text-sm text-[var(--cc-mid)]">
                    {m.score.home} – {m.score.away}
                  </p>
                ) : null}
                {typeof m.value === 'number' ? (
                  <p className="cc-mono mt-1 text-[0.65rem] text-[var(--cc-mid)]">
                    {m.market ?? 'Odds'} · {m.value.toFixed(2)}
                  </p>
                ) : null}
                {edge && edge.magnitude >= 35 ? (
                  <p className="mt-2 rounded-lg bg-[var(--cc-green-dim)] px-2 py-1 text-[0.62rem] text-[var(--cc-green)]">
                    EDGE {Math.round(edge.magnitude)}% · {edge.rationale.slice(0, 48)}
                  </p>
                ) : null}
                {proofHref ? (
                  <a
                    href={proofHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex text-[0.58rem] font-semibold text-[var(--cc-green)] hover:underline"
                  >
                    on-chain proof ↗
                  </a>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
