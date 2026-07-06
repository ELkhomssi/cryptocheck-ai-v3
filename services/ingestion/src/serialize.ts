/** JSON-safe GramJS entities for parser URL extraction. */
export function serializeEntities(entities: unknown[] | undefined): unknown[] {
  if (!entities?.length) return []
  return entities.map((entity) => {
    if (!entity || typeof entity !== 'object') return { raw: entity }
    const any = entity as Record<string, unknown>
    const row: Record<string, unknown> = {}
    for (const key of ['className', 'offset', 'length', 'url', 'userId', 'language']) {
      if (any[key] != null) row[key] = any[key]
    }
    return row
  })
}

export function channelAttribution(peer: unknown): string | null {
  if (!peer || typeof peer !== 'object') return null
  const p = peer as Record<string, unknown>
  if (typeof p.username === 'string' && p.username) return `@${p.username}`
  if (p.channelId != null) return String(p.channelId)
  if (p.chatId != null) return String(p.chatId)
  if (p.id != null) return String(p.id)
  return null
}
