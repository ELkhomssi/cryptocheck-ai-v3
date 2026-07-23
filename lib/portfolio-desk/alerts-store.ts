import 'server-only'

import type { PortfolioAlert } from '@/types/portfolio-desk'
import { cacheGet, cacheSet } from './cache'

const KEY = 'pd:alerts:v1'
const MAX = 100

/** In-process alert store (webhook writes). Redis/Supabase can replace later. */
export function listAlerts(limit = 20): PortfolioAlert[] {
  const all = cacheGet<PortfolioAlert[]>(KEY) ?? []
  return all.slice(0, limit)
}

export function pushAlert(alert: PortfolioAlert): void {
  const all = cacheGet<PortfolioAlert[]>(KEY) ?? []
  const next = [alert, ...all.filter((a) => a.id !== alert.id)].slice(0, MAX)
  // Keep for 24h so polling clients keep seeing them in this process
  cacheSet(KEY, next, 24 * 60 * 60 * 1000)
}

export function alertsForSymbols(symbols: Set<string>, limit = 20): PortfolioAlert[] {
  const all = listAlerts(MAX)
  if (!symbols.size) return all.slice(0, limit)
  return all
    .filter((a) => !a.tokenSymbol || symbols.has(a.tokenSymbol.toUpperCase()))
    .slice(0, limit)
}
