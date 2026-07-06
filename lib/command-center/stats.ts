import type { UnifiedSignal } from '@cryptocheck/signal-contracts'

export type AlphaFeedStats = {
  totalOpportunities: number
  totalOpportunities24h: number
  avgAiScore: number | null
  totalMentions: number
  totalMentions24h: number
  smartMoneyMoves: number
  smartMoneyMoves24h: number
}

const MS_24H = 24 * 60 * 60 * 1000

function isWithin24h(iso: string, now: number): boolean {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && now - t <= MS_24H
}

/** Honest aggregates from real UnifiedSignal rows — zeros when empty. */
export function computeAlphaFeedStats(signals: UnifiedSignal[]): AlphaFeedStats {
  const now = Date.now()
  const tokens = signals.filter((s) => s.subjectType === 'token' && !s.dropped && !s.sample)

  const tokens24h = tokens.filter((s) => isWithin24h(s.msgTimestamp, now))
  const scored = tokens.filter((s) => typeof s.scoreValue === 'number' && s.verdict !== 'scanning')
  const avgAiScore =
    scored.length > 0
      ? Math.round((scored.reduce((a, s) => a + (s.scoreValue ?? 0), 0) / scored.length) * 10) / 10
      : null

  const totalMentions = tokens.reduce((a, s) => a + (s.sourceCount ?? 1), 0)
  const totalMentions24h = tokens24h.reduce((a, s) => a + (s.sourceCount ?? 1), 0)

  const smartFilter = (s: UnifiedSignal) =>
    (s.sourceCount ?? 0) >= 2 || s.type === 'buy' || s.type === 'sell'
  const smartMoneyMoves = tokens.filter(smartFilter).length
  const smartMoneyMoves24h = tokens24h.filter(smartFilter).length

  return {
    totalOpportunities: tokens.length,
    totalOpportunities24h: tokens24h.length,
    avgAiScore,
    totalMentions,
    totalMentions24h,
    smartMoneyMoves,
    smartMoneyMoves24h,
  }
}

export type HotSortKey = 'score' | 'age' | 'liquidity'

export function rankHotOpportunities(
  signals: UnifiedSignal[],
  sort: HotSortKey,
  hours24Only: boolean,
): UnifiedSignal[] {
  const now = Date.now()
  let rows = signals.filter(
    (s) =>
      s.subjectType === 'token' &&
      !s.dropped &&
      !s.sample &&
      s.verdict !== 'scanning' &&
      typeof s.scoreValue === 'number',
  )

  if (hours24Only) {
    rows = rows.filter((s) => isWithin24h(s.msgTimestamp, now))
  }

  rows = [...rows]
  if (sort === 'score') {
    rows.sort((a, b) => (b.scoreValue ?? 0) - (a.scoreValue ?? 0))
  } else if (sort === 'age') {
    rows.sort((a, b) => new Date(b.msgTimestamp).getTime() - new Date(a.msgTimestamp).getTime())
  } else {
    rows.sort((a, b) => (b.sourceCount ?? 0) - (a.sourceCount ?? 0))
  }

  return rows.slice(0, 8)
}

const MS_YOUNG = 48 * 60 * 60 * 1000

/** Newest token signals under age threshold — honest empty when none. */
export function pickEarlyGems(signals: UnifiedSignal[], limit = 4): UnifiedSignal[] {
  const now = Date.now()
  return signals
    .filter(
      (s) =>
        s.subjectType === 'token' &&
        !s.dropped &&
        !s.sample &&
        now - new Date(s.msgTimestamp).getTime() <= MS_YOUNG,
    )
    .sort((a, b) => new Date(b.msgTimestamp).getTime() - new Date(a.msgTimestamp).getTime())
    .slice(0, limit)
}

/** Latest match_event per matchId for TxODDS strip. */
export function groupLiveMatches(signals: UnifiedSignal[], limit = 6): UnifiedSignal[] {
  const matches = signals.filter(
    (s) => s.subjectType === 'match_event' && s.sourceTag === 'txodds' && !s.dropped && !s.sample,
  )
  const byMatch = new Map<string, UnifiedSignal>()
  for (const m of matches) {
    const key = m.matchId ?? m.id
    const prev = byMatch.get(key)
    if (!prev || new Date(m.msgTimestamp) > new Date(prev.msgTimestamp)) {
      byMatch.set(key, m)
    }
  }
  return [...byMatch.values()]
    .sort((a, b) => new Date(b.msgTimestamp).getTime() - new Date(a.msgTimestamp).getTime())
    .slice(0, limit)
}
