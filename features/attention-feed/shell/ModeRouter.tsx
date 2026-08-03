'use client'

import { useSearchParams } from 'next/navigation'
import { AiOsShell } from '@/features/ai-os'
import { TerminalOsShell } from '@/features/terminal-os/shell/components/TerminalOsShell'

/**
 * Single Terminal experience → AI Operating System.
 * Legacy dense Pro chrome only via ?legacy=pro (or ?mode=pro for booth demos).
 * Simple Mode removed as a product surface.
 */
export function ModeRouter() {
  const searchParams = useSearchParams()
  const legacyPro =
    searchParams.get('legacy') === 'pro' ||
    searchParams.get('mode') === 'pro' ||
    searchParams.get('demo') === 'pro'

  if (legacyPro) {
    return <TerminalOsShell />
  }

  return <AiOsShell />
}
