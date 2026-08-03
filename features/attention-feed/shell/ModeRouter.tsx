'use client'

/**
 * @deprecated Dual-mode router retired. /terminalOS mounts AiOsShell directly.
 * Kept as a thin re-export so attention-feed barrel imports do not break.
 * TerminalOsShell (V6 Pro chrome) is never mounted from this path.
 */

import { AiOsShell } from '@/features/ai-os'

export function ModeRouter() {
  return <AiOsShell />
}
