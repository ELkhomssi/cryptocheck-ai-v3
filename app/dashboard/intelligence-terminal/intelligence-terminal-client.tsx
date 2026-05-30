'use client'

import { TerminalProvider } from '@/components/Dashboard/intelligence-terminal/TerminalProvider'
import { TerminalShell } from '@/components/Dashboard/intelligence-terminal/TerminalShell'
import { IntelligenceTradeTabs } from '@/components/trading/IntelligenceTradeTabs'

export function IntelligenceTerminalClient({ mint }: { mint: string }) {
  return (
    <TerminalProvider>
      <TerminalShell unlockedChildren={<IntelligenceTradeTabs mint={mint} />} />
    </TerminalProvider>
  )
}
