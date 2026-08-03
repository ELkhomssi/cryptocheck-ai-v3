'use client'

/**
 * RETIRED — Simple/Pro ModeRouter must not gate /terminalOS.
 * Page mounts TerminalOsShell directly. This stub exists only so
 * attention-feed barrel imports do not break; it never toggles modes.
 */

import { TerminalOsShell } from '@/features/terminal-os/shell/components/TerminalOsShell'

/** @deprecated Import TerminalOsShell from features/terminal-os instead. */
export function ModeRouter() {
  return <TerminalOsShell />
}
