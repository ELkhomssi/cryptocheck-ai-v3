/**
 * Map /terminalOS?nav=… (incl. legacy /terminal desk ids) onto TerminalNavId.
 */

import type { TerminalNavId } from '@/features/terminal-os/shared/types'

const TOS_NAV = new Set<string>([
  'terminal',
  'mission-control',
  'ai-scanner',
  'market-intel',
  'whale-tracking',
  'execution',
  'ai-trading',
  'copy-trading',
  'portfolio',
  'alerts',
  'watchlist',
  'settings',
  'security',
  'discovery',
  'ai-workforce',
  'scout',
  'ai-coach',
])

/** Legacy portfolio-desk ?nav= values → Terminal OS nav. */
const LEGACY: Record<string, TerminalNavId> = {
  mission: 'mission-control',
  coach: 'ai-coach',
  market: 'market-intel',
  screener: 'market-intel',
  watchlist: 'watchlist',
  trade: 'execution',
  portfolio: 'portfolio',
  automation: 'ai-workforce',
  intelligence: 'ai-workforce',
  employees: 'ai-workforce',
  feed: 'alerts',
  alerts: 'alerts',
  settings: 'settings',
  launchlab: 'discovery',
}

export function resolveTerminalOsNavParam(raw: string | null | undefined): TerminalNavId | null {
  const q = (raw || '').trim().toLowerCase()
  if (!q) return null
  if (TOS_NAV.has(q)) return q as TerminalNavId
  return LEGACY[q] ?? null
}
