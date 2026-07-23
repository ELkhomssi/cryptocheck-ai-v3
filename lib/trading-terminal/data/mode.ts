/**
 * Terminal data mode — production desk is live-only.
 * Demo seed remains available for tests via explicit env override only.
 *
 * Force live: default · or `NEXT_PUBLIC_TERMINAL_DATA_MODE=live`
 * Opt-in demo (dev/tests): `NEXT_PUBLIC_TERMINAL_DATA_MODE=demo`
 */

import type { TerminalDataMode } from './types'

export const DATA_MODE_STORAGE_KEY = 'ccai:trading-terminal:data-mode'

export function defaultDataMode(): TerminalDataMode {
  if (typeof process !== 'undefined') {
    const env = process.env.NEXT_PUBLIC_TERMINAL_DATA_MODE
    if (env === 'demo') return 'demo'
    if (env === 'live') return 'live'
  }
  // Production terminal: live APIs only — never silent demo numbers.
  return 'live'
}

export function readStoredDataMode(): TerminalDataMode | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(DATA_MODE_STORAGE_KEY)
    if (v === 'demo' || v === 'live') return v
  } catch {
    /* ignore */
  }
  return null
}

export function persistDataMode(mode: TerminalDataMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DATA_MODE_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}
