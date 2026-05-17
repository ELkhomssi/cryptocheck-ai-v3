'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { GRADIENTS } from '../pump-curve'
import { Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DeployForm } from '../terminal-types'
import { GlassCard } from './terminal-primitives'

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

  const previewGradient = useMemo(
    () => GRADIENTS[(name.length + ticker.length) % GRADIENTS.length],
    [name, ticker],
  )

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-labelledby="create-token-title"
            className="grid w-full max-w-2xl gap-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0a] shadow-[0_0_80px_rgba(34,197,94,0.15)] md:grid-cols-2"
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`relative flex min-h-[280px] flex-col items-center justify-center bg-gradient-to-br ${previewGradient} p-8`}
            >
              <div className="absolute inset-0 bg-black/20" />
              <motion.span
                className="relative text-7xl"
                key={ticker || name}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {ticker ? ticker.slice(0, 2) : '🚀'}
              </motion.span>
              <p className="relative mt-4 text-center text-lg font-bold text-white drop-shadow-lg">
                {name || 'Your coin'}
              </p>
              <p className="relative font-mono text-[#86efac]">${ticker || 'TICKER'}</p>
              <p className="relative mt-6 text-xs text-white/70">
                Initial buy · <span className="font-bold">{liquidity} SOL</span>
              </p>
            </div>

            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#86efac]" />
                  <h2 id="create-token-title" className="text-lg font-bold text-white">
                    Create coin
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
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
                  <span className="mb-1 block text-xs text-white/45">Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Neural Pepe"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-[#22c55e]/50"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-white/45">Ticker</span>
                  <input
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase().slice(0, 8))}
                    placeholder="NPEPE"
                    maxLength={8}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 font-mono uppercase text-[#86efac] outline-none focus:border-[#22c55e]/50"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-white/45">Description</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Fair launch on Web4 bonding curve…"
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-[#22c55e]/50"
                  />
                </label>
                <div>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-white/45">Initial buy (SOL)</span>
                    <span className="font-mono font-bold text-[#86efac]">{liquidity} SOL</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={50}
                    step={0.1}
                    value={liquidity}
                    onChange={(e) => onLiquidityChange(Number(e.target.value))}
                    className="w-full accent-[#22c55e]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={deploying || !name.trim() || !ticker.trim()}
                  className="web4-btn-primary w-full rounded-xl py-3.5 text-sm font-bold text-black disabled:opacity-50"
                >
                  {deploying ? 'Launching…' : 'Launch on bonding curve'}
                </button>
              </form>
              <p className="mt-3 text-center text-[0.65rem] text-white/35">
                85 SOL → Raydium · CryptoCheck audited · zero mint authority
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
