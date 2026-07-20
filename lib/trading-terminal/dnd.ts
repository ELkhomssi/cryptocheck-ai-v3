/** Shared DnD payload for Discover / Watchlist → ChartSlot. */

export type TitDragPayload = {
  mint: string
  symbol: string
}

export function encodeTitDrag(payload: TitDragPayload): string {
  return JSON.stringify(payload)
}

export function decodeTitDrag(raw: string | undefined | null): TitDragPayload | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return null
    const r = o as Record<string, unknown>
    if (typeof r.mint !== 'string' || r.mint.length < 32) return null
    return {
      mint: r.mint,
      symbol: typeof r.symbol === 'string' ? r.symbol : r.mint.slice(0, 6),
    }
  } catch {
    return null
  }
}
