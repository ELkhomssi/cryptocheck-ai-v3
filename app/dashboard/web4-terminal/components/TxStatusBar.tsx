'use client'

import type { TxLifecycle } from '@/lib/web4/protocol/types'

const LABELS: Record<TxLifecycle['phase'], string> = {
  idle: '',
  building: 'Building transaction',
  signed: 'Signed — broadcasting',
  sent: 'Submitted',
  processed: 'Processed',
  confirmed: 'Confirmed',
  finalized: 'Finalized on-chain',
  error: 'Failed',
}

export function TxStatusBar({ lifecycle }: { lifecycle: TxLifecycle }) {
  if (lifecycle.phase === 'idle') return null

  const isError = lifecycle.phase === 'error'
  const isDone = lifecycle.phase === 'finalized'

  return (
    <div
      className={`fixed bottom-20 left-1/2 z-[105] flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
        isError
          ? 'border-[#f87171]/50 bg-[#1a1a1a] text-[#f87171]'
          : isDone
            ? 'border-[#86efac]/50 bg-[#1a1a1a] text-[#86efac]'
            : 'border-[#2a2a2a] bg-[#1a1a1a] text-white'
      }`}
      role="status"
    >
      {!isError && !isDone ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#333] border-t-[#86efac]" />
      ) : null}
      <span>{LABELS[lifecycle.phase]}</span>
      {lifecycle.signature ? (
        <a
          href={`https://solscan.io/tx/${lifecycle.signature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-[#888] hover:text-[#86efac]"
        >
          {lifecycle.signature.slice(0, 8)}…
        </a>
      ) : null}
    </div>
  )
}
