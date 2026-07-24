import 'server-only'

import type { PortfolioAlert } from '@/types/portfolio-desk'
import { cacheGet, cacheSet } from './cache'

const KEY = 'pd:alerts:v1'
const MAX = 100

function memList(limit = 20): PortfolioAlert[] {
  const all = cacheGet<PortfolioAlert[]>(KEY) ?? []
  return all.slice(0, limit)
}

function memPush(alert: PortfolioAlert): void {
  const all = cacheGet<PortfolioAlert[]>(KEY) ?? []
  const next = [alert, ...all.filter((a) => a.id !== alert.id)].slice(0, MAX)
  cacheSet(KEY, next, 24 * 60 * 60 * 1000)
}

function rowToAlert(row: {
  id: string
  type: string
  title: string
  description: string
  severity: string
  token_symbol: string | null
  mint: string | null
  created_at: string
}): PortfolioAlert {
  return {
    id: row.id,
    type: row.type as PortfolioAlert['type'],
    title: row.title,
    description: row.description,
    severity: row.severity as PortfolioAlert['severity'],
    tokenSymbol: row.token_symbol,
    mint: row.mint,
    createdAt: row.created_at,
  }
}

function hasAdminEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

/** Latest alerts — prefers Supabase `portfolio_alerts`, falls back to in-process cache. */
export async function listAlerts(limit = 20): Promise<PortfolioAlert[]> {
  if (hasAdminEnv()) {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const sb = getSupabaseAdmin()
      const { data, error } = await sb
        .from('portfolio_alerts')
        .select('id,type,title,description,severity,token_symbol,mint,created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (!error && data) return data.map(rowToAlert)
    } catch {
      /* fall through to memory */
    }
  }
  return memList(limit)
}

export async function pushAlert(alert: PortfolioAlert): Promise<void> {
  memPush(alert)
  if (!hasAdminEnv()) return
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const sb = getSupabaseAdmin()
    await sb.from('portfolio_alerts').upsert(
      {
        id: alert.id,
        type: alert.type,
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        token_symbol: alert.tokenSymbol,
        mint: alert.mint,
        created_at: alert.createdAt,
      },
      { onConflict: 'id' },
    )
  } catch {
    /* memory already updated */
  }
}

export async function alertsForSymbols(
  symbols: Set<string>,
  limit = 20,
): Promise<PortfolioAlert[]> {
  const all = await listAlerts(MAX)
  if (!symbols.size) return all.slice(0, limit)
  return all
    .filter((a) => !a.tokenSymbol || symbols.has(a.tokenSymbol.toUpperCase()))
    .slice(0, limit)
}
