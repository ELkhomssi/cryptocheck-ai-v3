import { CHART_MODES, WORKSPACE_STORAGE_KEY, type ChartMode } from './constants'
import type { ChartSlotState } from './types'

export type PersistedWorkspace = {
  v: 1
  chartMode: ChartMode
  slots: ChartSlotState[]
  activeSlot: number
  focusMint: string
  focusSymbol: string
  coachCollapsed: boolean
  discoverCollapsed: boolean
  activeWatchlistId: string
  updatedAt: string
}

function isChartMode(n: unknown): n is ChartMode {
  return typeof n === 'number' && (CHART_MODES as number[]).includes(n)
}

function parseSlot(raw: unknown): ChartSlotState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.mint !== 'string' || typeof o.symbol !== 'string') return null
  return {
    mint: o.mint,
    symbol: o.symbol,
    locked: Boolean(o.locked),
  }
}

export function emptySlots(n: number): ChartSlotState[] {
  return Array.from({ length: n }, () => ({ mint: '', symbol: '', locked: false }))
}

export function parseWorkspace(raw: string | null): PersistedWorkspace | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as Record<string, unknown>
    if (o.v !== 1 || !isChartMode(o.chartMode)) return null
    if (!Array.isArray(o.slots)) return null
    const slots = o.slots.map(parseSlot).filter((s): s is ChartSlotState => s != null)
    const mode = o.chartMode
    const normalized = emptySlots(mode)
    for (let i = 0; i < Math.min(slots.length, normalized.length); i++) {
      normalized[i] = slots[i]!
    }
    const activeSlot =
      typeof o.activeSlot === 'number'
        ? Math.min(Math.max(0, Math.floor(o.activeSlot)), mode - 1)
        : 0
    return {
      v: 1,
      chartMode: mode,
      slots: normalized,
      activeSlot,
      focusMint: typeof o.focusMint === 'string' ? o.focusMint : '',
      focusSymbol: typeof o.focusSymbol === 'string' ? o.focusSymbol : '',
      coachCollapsed: Boolean(o.coachCollapsed),
      discoverCollapsed: Boolean(o.discoverCollapsed),
      activeWatchlistId: typeof o.activeWatchlistId === 'string' ? o.activeWatchlistId : 'default',
      updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function loadWorkspace(): PersistedWorkspace | null {
  if (typeof window === 'undefined') return null
  try {
    return parseWorkspace(window.localStorage.getItem(WORKSPACE_STORAGE_KEY))
  } catch {
    return null
  }
}

export function saveWorkspace(ws: Omit<PersistedWorkspace, 'v' | 'updatedAt'>): void {
  if (typeof window === 'undefined') return
  const payload: PersistedWorkspace = {
    v: 1,
    ...ws,
    updatedAt: new Date().toISOString(),
  }
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode — ignore */
  }
}
