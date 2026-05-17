'use client'

import { JupiterTerminalEmbed } from '@/components/JupiterTerminalEmbed'

/** In-page Jupiter Terminal — wallet passthrough via root SolanaProvider. */
export function Web4JupiterPanel({
  mint,
  visible,
  onClose,
}: {
  mint: string
  visible: boolean
  onClose: () => void
}) {
  if (!visible) return null

  return (
    <section
      className="mt-4 overflow-hidden rounded-xl border border-[#00E5FF]/25 bg-black/80 shadow-[0_0_30px_rgba(0,229,255,0.12)] backdrop-blur-xl"
      aria-label="Jupiter swap terminal"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-[#00E5FF]">
          Jupiter · AI-Protected Swap
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-[0.65rem] text-white/50 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
          aria-label="Close Jupiter terminal"
        >
          Close
        </button>
      </div>
      <JupiterTerminalEmbed mint={mint} minHeight={400} className="min-h-[400px] w-full" />
    </section>
  )
}
