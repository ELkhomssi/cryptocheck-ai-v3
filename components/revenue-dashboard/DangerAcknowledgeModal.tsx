'use client'

import { useEffect, useRef } from 'react'
import { ShieldX } from 'lucide-react'

export const DANGER_ACK_PHRASE = 'I understand this token is high risk'

type Props = {
  open: boolean
  typed: string
  onTypedChange: (v: string) => void
  onConfirm: () => void
  onClose: () => void
}

export function DangerAcknowledgeModal({ open, typed, onTypedChange, onConfirm, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!open) return null

  const match = typed.trim().toLowerCase() === DANGER_ACK_PHRASE.toLowerCase()

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="danger-modal-title"
    >
      <div className="rd-panel max-w-md w-full p-5 shadow-2xl">
        <div className="mb-3 flex items-center gap-2 text-rd-danger">
          <ShieldX className="h-5 w-5" aria-hidden />
          <h3 id="danger-modal-title" className="font-rd-display text-sm font-bold uppercase tracking-wide">
            High risk token
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-rd-mid">
          Neural scan flagged this token as <strong className="text-rd-danger">DANGER</strong>. Swapping is
          disabled until you explicitly acknowledge the risk. CryptoCheck does not recommend proceeding.
        </p>
        <p className="mt-4 rd-label">Type to enable swap</p>
        <p className="mt-1 font-rd-mono text-xs text-rd-lo">{DANGER_ACK_PHRASE}</p>
        <input
          ref={inputRef}
          type="text"
          value={typed}
          onChange={(e) => onTypedChange(e.target.value)}
          className="mt-2 w-full rounded-rd-sm border border-rd-danger/40 bg-rd-navy/90 px-3 py-2 font-rd-mono text-sm text-rd-hi focus:border-rd-danger focus:outline-none focus:ring-1 focus:ring-rd-danger/40"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-rd-sm border border-white/15 px-4 py-2 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider text-rd-mid hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!match}
            onClick={onConfirm}
            className="flex-1 rounded-rd-sm border border-rd-danger/50 bg-rd-danger/20 px-4 py-2 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider text-rd-danger disabled:opacity-40"
          >
            Enable swap
          </button>
        </div>
      </div>
    </div>
  )
}
