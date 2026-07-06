'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export function NeuralV4PromoCard() {
  return (
    <div className="rounded-dash-inner border border-dash-innerline bg-dash-panel2 p-3">
      <div className="flex items-center gap-2">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-dash-inner bg-gradient-to-br from-dash-greenDeep to-dash-panel shadow-dash-ring"
          aria-hidden
        >
          <Sparkles className="h-5 w-5 text-dash-green" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-dash-green">NEURAL V4</p>
          <p className="text-xs text-dash-tmid">The most advanced AI engine in crypto</p>
        </div>
      </div>
      <Link
        href="/docs"
        className="mt-3 block rounded-dash-chip bg-dash-green py-2 text-center text-xs font-semibold text-dash-bg transition-colors duration-150 hover:bg-dash-greenHi focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green"
      >
        Learn More
      </Link>
    </div>
  )
}
