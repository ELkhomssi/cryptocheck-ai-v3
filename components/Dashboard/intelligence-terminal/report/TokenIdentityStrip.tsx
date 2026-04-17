'use client'

/**
 * TokenIdentityStrip — full-width top strip on the report grid.
 * Shows token avatar, name, symbol, truncated mint (with copy),
 * and a DexScreener external link.
 */

import { ExternalLink } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import type { TokenIntelligenceReport } from '@/lib/types/intelligence'
import { Card } from '../primitives/Card'
import { CopyButton } from '../primitives/CopyButton'
import { shortMint } from '../primitives/format'

export function TokenIdentityStrip({
  report,
}: {
  report: TokenIntelligenceReport
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = Boolean(report.imageUrl) && !imgFailed

  return (
    <Card className="flex items-center gap-4 px-6 py-4">
      {showImage ? (
        <Image
          src={report.imageUrl as string}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full border border-white/10 bg-slate-900 object-cover"
          onError={() => setImgFailed(true)}
          unoptimized
        />
      ) : (
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-900 font-mono text-xs font-bold uppercase text-slate-500"
        >
          {(report.symbol || '?').slice(0, 2)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-100">
            {report.name || 'Unknown'}
          </h1>
          <span className="shrink-0 font-mono text-sm text-slate-400">
            ${report.symbol || '—'}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <code
            className="truncate font-mono text-xs text-slate-500"
            title={report.mint}
          >
            {shortMint(report.mint, 8, 8)}
          </code>
          <CopyButton value={report.mint} label="Copy mint address" />
        </div>
      </div>

      <a
        href={`https://dexscreener.com/solana/${report.mint}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open on DexScreener"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/5 hover:text-[#00d4aa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa]/50"
      >
        <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
    </Card>
  )
}
