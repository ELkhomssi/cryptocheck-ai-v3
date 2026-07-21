/**
 * Terminal data mode — demo (labeled DEMO_SEED) vs live (honest empties).
 *
 * Flip modes:
 *   - UI toggle in top bar (persists to localStorage)
 *   - env `NEXT_PUBLIC_TERMINAL_DATA_MODE=demo|live`
 *
 * Default is `demo` with a visible DEMO DATA badge until live feeds are product-ready.
 * Set NEXT_PUBLIC_TERMINAL_DATA_MODE=live to force production truth by default.
 */

import type { TerminalDataMode } from './types'

export const DATA_MODE_STORAGE_KEY = 'ccai:trading-terminal:data-mode'

export function defaultDataMode(): TerminalDataMode {
  if (typeof process !== 'undefined') {
    const env = process.env.NEXT_PUBLIC_TERMINAL_DATA_MODE
    if (env === 'demo' || env === 'live') return env
  }
  // Labeled demo until live ingestion is deployed end-to-end — never silent fakes.
  return 'demo'
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
