'use client'

export type ConnectionState = 'connecting' | 'listening' | 'live' | 'reconnecting' | 'down'

const DOT: Record<ConnectionState, string> = {
  connecting: 'bg-rd-caution animate-pulse',
  listening: 'bg-dash-green animate-pulse',
  live: 'bg-rd-safe shadow-[0_0_8px_rgba(63,224,90,0.55)]',
  reconnecting: 'bg-rd-caution animate-pulse',
  down: 'bg-rd-danger',
}

const LABEL: Record<ConnectionState, string> = {
  connecting: 'Connecting to live feed…',
  listening: 'Live · listening…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
  down: 'Feed unavailable',
}

type Props = {
  state: ConnectionState
  tier?: string
  delayLabel?: string
  className?: string
}

export function ConnectionPill({ state, tier, delayLabel, className = '' }: Props) {
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-rd-navy/70 px-3 py-1.5 text-[0.65rem] text-rd-mid ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${DOT[state]}`} aria-hidden />
      <span className="font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-rd-hi">
        {LABEL[state]}
      </span>
      {tier ? (
        <>
          <span className="text-rd-lo" aria-hidden>
            ·
          </span>
          <span className="font-rd-display text-[0.55rem] font-bold uppercase tracking-wider">
            {tier}
          </span>
        </>
      ) : null}
      {delayLabel ? (
        <>
          <span className="text-rd-lo" aria-hidden>
            ·
          </span>
          <span className="font-rd-mono tabular-nums text-rd-lo">{delayLabel}</span>
        </>
      ) : null}
    </div>
  )
}
