'use client'

import { isWeb4ProgramConfigured } from '@/lib/web4/protocol/config'

export function ProtocolBanner() {
  if (isWeb4ProgramConfigured()) {
    return (
      <div className="border-b border-[#86efac]/30 bg-[#1a1a1a] px-4 py-2 text-center text-xs text-[#86efac]">
        Mainnet · real SOL · bonding curve program active
      </div>
    )
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-center text-xs text-amber-200">
      Set <code className="rounded bg-black/40 px-1">NEXT_PUBLIC_WEB4_PROGRAM_ID</code> after{' '}
      <code className="rounded bg-black/40 px-1">anchor deploy</code> to enable on-chain create &amp; trade.
    </div>
  )
}
