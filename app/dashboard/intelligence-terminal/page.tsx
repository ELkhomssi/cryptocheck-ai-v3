import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TerminalProvider } from '@/components/Dashboard/intelligence-terminal/TerminalProvider'
import { TerminalShell } from '@/components/Dashboard/intelligence-terminal/TerminalShell'

export const metadata = {
  title: 'Analysis Console — CryptoCheck AI',
  description: 'Authenticated Solana intelligence terminal.',
}

export default async function IntelligenceTerminalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/landing?next=%2Fdashboard%2Fintelligence-terminal')
  }

  return (
    <TerminalProvider>
      <TerminalShell />
    </TerminalProvider>
  )
}
