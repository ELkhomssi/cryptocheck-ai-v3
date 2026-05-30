'use client'

import { X } from 'lucide-react'
import { useState } from 'react'
import type { DeployForm } from '../terminal-types'

export function CreateTokenModal({
  open,
  onClose,
  onDeploy,
  deploying,
  liquidity,
  onLiquidityChange,
}: {
  open: boolean
  onClose: () => void
  onDeploy: (form: DeployForm) => void
  deploying: boolean
  liquidity: number
  onLiquidityChange: (n: number) => void
}) {
  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [description, setDescription] = useState('')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-labelledby="create-token-title"
        className="web4-panel w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="create-token-title" className="text-lg font-semibold text-white">
            Create coin
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#666] hover:bg-[#222] hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            onDeploy({ name, ticker, description, liquidity })
            setName('')
            setTicker('')
            setDescription('')
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs text-[#888]">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Token"
              className="web4-input w-full px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[#888]">Ticker</span>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase().slice(0, 8))}
              placeholder="TOKEN"
              maxLength={8}
              className="web4-input w-full px-3 py-2.5 font-mono text-sm uppercase"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[#888]">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description"
              className="web4-input w-full resize-none px-3 py-2.5 text-sm"
            />
          </label>
          <div>
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-[#888]">Initial buy (SOL)</span>
              <span className="font-medium tabular-nums text-[#86efac]">{liquidity} SOL</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={50}
              step={0.1}
              value={liquidity}
              onChange={(e) => onLiquidityChange(Number(e.target.value))}
              className="w-full accent-[#86efac]"
            />
          </div>
          <button
            type="submit"
            disabled={deploying || !name.trim() || !ticker.trim()}
            className="web4-btn-create w-full py-3 text-sm disabled:opacity-50"
          >
            {deploying ? 'Creating…' : 'Create coin'}
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-[#666]">
          Bonding curve · graduates at 85 SOL
        </p>
      </div>
    </div>
  )
}
