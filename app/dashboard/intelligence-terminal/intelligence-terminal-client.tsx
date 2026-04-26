'use client'

import { IntelligencePanel } from '@/components/Dashboard/intelligence-panel/IntelligencePanel'
import { TerminalProvider } from '@/components/Dashboard/intelligence-terminal/TerminalProvider'
import { TerminalShell } from '@/components/Dashboard/intelligence-terminal/TerminalShell'

export function IntelligenceTerminalClient({ mint }: { mint: string }) {
  return (
    <TerminalProvider>
      <TerminalShell unlockedChildren={<IntelligencePanel mint={mint} />} />
    </TerminalProvider>
  )
}
