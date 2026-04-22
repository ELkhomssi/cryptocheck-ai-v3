import { TerminalProvider } from '@/components/Dashboard/intelligence-terminal/TerminalProvider'
import { TerminalShell } from '@/components/Dashboard/intelligence-terminal/TerminalShell'

export const metadata = {
  title: 'Analysis Console — CryptoCheck AI',
  description: 'Authenticated Solana intelligence terminal.',
}

export default async function IntelligenceTerminalPage() {
  return (
    <TerminalProvider>
      <TerminalShell />
    </TerminalProvider>
  )
}
