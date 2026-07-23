import { redirect } from 'next/navigation'
import { TerminalShell } from '@/components/trading-terminal/TerminalShell'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Terminal · CryptoCheck AI',
  description:
    'AI Trading Intelligence Terminal — Discover. Analyze. Trade. Monitor. Improve. One screen.',
}

/**
 * Canonical terminal route: /terminal only.
 * Strip legacy version query (?v=2) so there is a single production desk.
 */
export default function TerminalPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  if (searchParams?.v != null) {
    redirect('/terminal')
  }

  return <TerminalShell />
}
