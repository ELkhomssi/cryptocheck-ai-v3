import { WATCHLIST_STORAGE_KEY } from './constants'

export type WatchlistItem = {
  mint: string
  symbol: string
  addedAt: string
  /** Last known coach/risk badge from focus scan — optional, never fabricated. */
  lastVerdict?: string
  lastRiskScore?: number
}

export type TerminalWatchlist = {
  id: string
  name: string
  items: WatchlistItem[]
}

export type PersistedWatchlists = {
  v: 1
  lists: TerminalWatchlist[]
  updatedAt: string
}

export function defaultWatchlists(): PersistedWatchlists {
  return {
    v: 1,
    lists: [{ id: 'default', name: 'Main', items: [] }],
    updatedAt: new Date().toISOString(),
  }
}

function parseItem(raw: unknown): WatchlistItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.mint !== 'string' || o.mint.length < 32) return null
  if (typeof o.symbol !== 'string') return null
  return {
    mint: o.mint,
    symbol: o.symbol,
    addedAt: typeof o.addedAt === 'string' ? o.addedAt : new Date().toISOString(),
    lastVerdict: typeof o.lastVerdict === 'string' ? o.lastVerdict : undefined,
    lastRiskScore: typeof o.lastRiskScore === 'number' ? o.lastRiskScore : undefined,
  }
}

export function parseWatchlists(raw: string | null): PersistedWatchlists {
  if (!raw) return defaultWatchlists()
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return defaultWatchlists()
    const o = parsed as Record<string, unknown>
    if (o.v !== 1 || !Array.isArray(o.lists)) return defaultWatchlists()
    const lists: TerminalWatchlist[] = []
    for (const row of o.lists) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      if (typeof r.id !== 'string' || typeof r.name !== 'string' || !Array.isArray(r.items)) continue
      lists.push({
        id: r.id,
        name: r.name.slice(0, 40),
        items: r.items.map(parseItem).filter((i): i is WatchlistItem => i != null),
      })
    }
    if (lists.length === 0) return defaultWatchlists()
    return {
      v: 1,
      lists,
      updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
    }
  } catch {
    return defaultWatchlists()
  }
}

export function loadWatchlists(): PersistedWatchlists {
  if (typeof window === 'undefined') return defaultWatchlists()
  try {
    return parseWatchlists(window.localStorage.getItem(WATCHLIST_STORAGE_KEY))
  } catch {
    return defaultWatchlists()
  }
}

export function saveWatchlists(lists: TerminalWatchlist[]): void {
  if (typeof window === 'undefined') return
  const payload: PersistedWatchlists = {
    v: 1,
    lists,
    updatedAt: new Date().toISOString(),
  }
  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function upsertWatchlistItem(
  lists: TerminalWatchlist[],
  listId: string,
  item: Omit<WatchlistItem, 'addedAt'> & { addedAt?: string },
): TerminalWatchlist[] {
  return lists.map((list) => {
    if (list.id !== listId) return list
    const exists = list.items.findIndex((i) => i.mint === item.mint)
    const nextItem: WatchlistItem = {
      mint: item.mint,
      symbol: item.symbol,
      addedAt: item.addedAt ?? new Date().toISOString(),
      lastVerdict: item.lastVerdict,
      lastRiskScore: item.lastRiskScore,
    }
    if (exists >= 0) {
      const items = [...list.items]
      items[exists] = { ...items[exists]!, ...nextItem, addedAt: items[exists]!.addedAt }
      return { ...list, items }
    }
    return { ...list, items: [nextItem, ...list.items] }
  })
}

export function removeWatchlistItem(
  lists: TerminalWatchlist[],
  listId: string,
  mint: string,
): TerminalWatchlist[] {
  return lists.map((list) =>
    list.id !== listId ? list : { ...list, items: list.items.filter((i) => i.mint !== mint) },
  )
}

export function cycleWatchlistId(lists: TerminalWatchlist[], currentId: string): string {
  if (lists.length === 0) return 'default'
  const idx = lists.findIndex((l) => l.id === currentId)
  const next = lists[(idx + 1) % lists.length]
  return next?.id ?? lists[0]!.id
}
