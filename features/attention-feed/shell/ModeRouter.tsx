'use client'

import { useSearchParams } from 'next/navigation'
import { TerminalOsShell } from '@/features/terminal-os/shell/components/TerminalOsShell'
import { AiOsShell } from '@/features/ai-os'

/**
 * Terminal OS entry — AI Operating System is the product.
 * Legacy dense Pro shell available only via ?legacy=pro (no Simple/Pro toggle).
 */
export function ModeRouter() {
  const searchParams = useSearchParams()
  const legacyPro = searchParams.get('legacy') === 'pro'

  if (legacyPro) {
    return (
      <div data-tos>
        <TerminalOsShell />
      </div>
    )
  }

  return <AiOsShell />
}
