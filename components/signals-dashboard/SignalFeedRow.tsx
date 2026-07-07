'use client'

import Link from 'next/link'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import {
  canSwapSignal,
  eventTypeLabel,
  formatAge,
  sourceBadgeClasses,
  sourceTagLabel,
  sourcesLabel,
  truncateCa,
  verdictClasses,
} from '@/lib/signals-dashboard/format'

type Props = {
  signal: UnifiedSignal
  style?: React.CSSProperties
  isRecent?: boolean
  delayedBySec?: number
  onSwap: (signal: UnifiedSignal) => void
}

export function SignalFeedRow({ signal, style, isRecent, delayedBySec, onSwap }: Props) {
  const isToken = signal.subjectType === 'token'
  const swapOk = canSwapSignal(signal)
  const danger = signal.verdict === 'danger'
  const score = signal.scoreValue

  return (
    <div
      style={style}
      className={`flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5 transition-colors hover:bg-white/[0.03] focus-within:bg-white/[0.02] ${
        isRecent ? 'motion-safe:animate-[fadeIn_0.4s_ease-out] bg-rd-green/[0.05]' : ''
      } ${!isToken ? 'bg-amber-400/[0.03]' : ''}`}
      data-subject={signal.subjectType}
      data-source={signal.sourceTag}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-rd-display text-sm font-bold uppercase tracking-wide text-rd-hi">
            {signal.label}
          </span>

          {isToken && signal.contractAddress ? (
            <span className="font-rd-mono text-[0.65rem] text-rd-lo">
              {truncateCa(signal.contractAddress)}
            </span>
          ) : null}

          {!isToken && signal.score ? (
            <span className="rounded border border-amber-400/20 bg-amber-400/5 px-1.5 py-0.5 font-rd-mono text-[0.7rem] tabular-nums text-amber-100">
              {signal.score.home}–{signal.score.away}
            </span>
          ) : null}

          <span className="rounded border border-white/10 px-1.5 py-0.5 font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-rd-mid">
            {eventTypeLabel(String(signal.type))}
          </span>

          <span
            className={`rounded border px-1.5 py-0.5 font-rd-display text-[0.5rem] font-bold uppercase tracking-wider ${sourceBadgeClasses(signal.sourceTag)}`}
          >
            {sourceTagLabel(signal.sourceTag)}
          </span>

          {signal.sample ? (
            <span className="rd-sample-tag rounded border border-white/20 px-1.5 py-0.5 font-rd-display text-[0.5rem] font-bold uppercase tracking-wider text-rd-lo">
              sample
            </span>
          ) : null}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.65rem] text-rd-mid">
          <span title={(signal.sources ?? []).join(', ')}>{sourcesLabel(signal)}</span>
          <span aria-hidden>·</span>
          <span>{formatAge(signal.msgTimestamp)}</span>

          {isToken && signal.chain ? (
            <>
              <span aria-hidden>·</span>
              <span className="uppercase">{signal.chain}</span>
            </>
          ) : null}

          {isToken && signal.value != null ? (
            <>
              <span aria-hidden>·</span>
              <span className="font-rd-mono tabular-nums">${signal.value}</span>
            </>
          ) : null}

          {!isToken && signal.market ? (
            <>
              <span aria-hidden>·</span>
              <span className="max-w-[12rem] truncate" title={signal.market}>
                {signal.market}
              </span>
            </>
          ) : null}

          {!isToken && signal.matchId ? (
            <>
              <span aria-hidden>·</span>
              <span className="font-rd-mono text-rd-lo">#{signal.matchId}</span>
            </>
          ) : null}
        </div>

        {delayedBySec ? (
          <p className="mt-1.5 text-[0.62rem] text-amber-200">
            Pro traders saw this {Math.round(delayedBySec / 1000)}s ago —{' '}
            <Link href="/app/upgrade" className="font-semibold text-rd-safe hover:underline">
              Upgrade
            </Link>
          </p>
        ) : null}
      </div>

      <span
        className={`shrink-0 rounded border px-2 py-1 font-rd-display text-[0.55rem] font-bold uppercase tracking-wider ${verdictClasses(signal.verdict)}`}
        title={
          !isToken
            ? 'Informational only — not a swap recommendation'
            : signal.verdict === 'scanning'
              ? 'Risk scan in progress'
              : undefined
        }
      >
        {signal.verdict}
        {score != null ? (
          <span className="ml-1 font-rd-mono tabular-nums">{Math.round(score)}</span>
        ) : null}
      </span>

      {isToken ? (
        <button
          type="button"
          disabled={!swapOk}
          onClick={() => onSwap(signal)}
          className={`shrink-0 rounded-rd-sm px-3 py-2 font-rd-display text-[0.58rem] font-bold uppercase tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/60 ${
            swapOk
              ? danger
                ? 'border border-rd-danger/50 bg-rd-danger/10 text-rd-danger'
                : 'bg-rd-green text-rd-navy'
              : 'cursor-not-allowed border border-white/10 text-rd-lo'
          }`}
          aria-label={`Safe swap ${signal.label}`}
        >
          Safe Swap
        </button>
      ) : (
        <span
          className="shrink-0 rounded-rd-sm border border-amber-400/20 bg-amber-400/5 px-3 py-2 font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-amber-200/80"
          title="Sports signals are informational only — not swap recommendations"
        >
          Info only
        </span>
      )}
    </div>
  )
}
