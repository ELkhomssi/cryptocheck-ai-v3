'use client'

type Props = {
  onRetry: () => void
  message?: string
}

/** Calm inline error — never shows raw exception text. */
export function FeedErrorCard({ onRetry, message }: Props) {
  return (
    <div
      className="rd-panel flex flex-wrap items-center justify-between gap-3 border-rd-caution/30 bg-rd-caution/5 px-4 py-3"
      role="status"
    >
      <div>
        <p className="font-rd-display text-[0.58rem] font-bold uppercase tracking-wider text-rd-caution">
          Live feed temporarily unavailable
        </p>
        <p className="mt-0.5 text-xs text-rd-mid">{message ?? 'Retrying automatically…'}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-rd-sm border border-white/15 bg-white/5 px-3 py-2 font-rd-display text-[0.55rem] font-bold uppercase tracking-wider text-rd-hi transition-colors hover:border-rd-green/40 hover:bg-rd-green/10 hover:text-rd-green focus:outline-none focus-visible:ring-2 focus-visible:ring-rd-green/50"
      >
        Retry
      </button>
    </div>
  )
}
