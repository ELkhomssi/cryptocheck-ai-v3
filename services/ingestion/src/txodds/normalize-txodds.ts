import type { MatchEventType, UnifiedSignal } from '@cryptocheck/signal-contracts'
import { namespacedSignalId } from '@cryptocheck/signal-contracts'
import type { FixtureMeta } from './fixture-cache.js'
import type { TxOddsOddsPayload, TxOddsRawPacket, TxOddsScoresPayload } from './types.js'

function soccerTotalGoals(
  scoreSoccer: TxOddsScoresPayload['scoreSoccer'],
): { home: number; away: number } | undefined {
  if (!scoreSoccer?.Participant1 || !scoreSoccer?.Participant2) return undefined

  const sumGoals = (p: {
    HT?: { Goals?: number }
    H1?: { Goals?: number }
    H2?: { Goals?: number }
  }): number => {
    const ht = p.HT?.Goals ?? 0
    const h1 = p.H1?.Goals ?? 0
    const h2 = p.H2?.Goals ?? 0
    return Math.max(ht, h1 + h2)
  }

  return {
    home: sumGoals(scoreSoccer.Participant1),
    away: sumGoals(scoreSoccer.Participant2),
  }
}

function mapScoresEventType(payload: TxOddsScoresPayload): MatchEventType {
  const soccer = payload.dataSoccer
  if (soccer?.Goal) return 'goal'
  if (soccer?.RedCard) return 'red_card'
  if (soccer?.YellowCard) return 'yellow_card'

  const action = (soccer?.Action ?? payload.action ?? '').toLowerCase()
  if (action.includes('kickoff') || action.includes('kick off')) return 'kickoff'

  const state = (payload.gameState ?? '').toUpperCase()
  if (state === 'F' || state === 'FET' || state === 'FPE') return 'full_time'
  if (state === 'NS' && action.includes('start')) return 'kickoff'

  return 'score_change'
}

function oddsMarketLabel(payload: TxOddsOddsPayload): string {
  const parts = [payload.SuperOddsType, payload.MarketPeriod, payload.MarketParameters].filter(
    Boolean,
  )
  return parts.join(' · ') || 'odds'
}

function oddsValue(payload: TxOddsOddsPayload): number | undefined {
  const pct = payload.Pct?.[0]
  if (pct && pct !== 'NA') {
    const n = Number(pct)
    if (Number.isFinite(n)) return n
  }
  const price = payload.Prices?.[0]
  if (typeof price === 'number' && Number.isFinite(price)) return price
  return undefined
}

function oddsEventType(payload: TxOddsOddsPayload): MatchEventType {
  const names = (payload.PriceNames ?? []).map((n) => n.toLowerCase())
  if (names.some((n) => n.includes('lay'))) return 'lay'
  if (names.some((n) => n.includes('back'))) return 'back'
  return 'odds_shift'
}

function fixtureMeta(fixtureId: number, lookup?: FixtureMeta): Pick<UnifiedSignal, 'label' | 'teams'> {
  if (lookup) {
    return {
      label: `${lookup.home} vs ${lookup.away}`,
      teams: { home: lookup.home, away: lookup.away },
    }
  }
  const label = `Fixture ${fixtureId}`
  return { label }
}

export function normalizeTxOddsPacket(
  packet: TxOddsRawPacket,
  lookup?: FixtureMeta,
): UnifiedSignal | null {
  const ingestTimestamp = new Date().toISOString()

  if (packet.kind === 'scores') {
    const payload = packet.payload
    const fixtureId = payload.fixtureId
    const seq = payload.seq
    if (!Number.isFinite(fixtureId) || !Number.isFinite(seq)) return null

    const sourceRef = `${fixtureId}:${seq}`
    const meta = lookup ?? undefined
    const { label, teams } = fixtureMeta(fixtureId, meta)
    const score = soccerTotalGoals(payload.scoreSoccer)

    return {
      id: namespacedSignalId('txodds', sourceRef),
      sourceTag: 'txodds',
      sourceRef,
      subjectType: 'match_event',
      label,
      type: mapScoresEventType(payload),
      value: score ? score.home + score.away : undefined,
      msgTimestamp: new Date(payload.ts).toISOString(),
      ingestTimestamp,
      confidence: 1,
      matchId: String(fixtureId),
      teams,
      score,
      market: payload.gameState,
      verdict: 'scanning',
      rawPayload: {
        stream: 'scores',
        ...payload,
      },
      sources: ['txodds'],
      sourceCount: 1,
    }
  }

  const payload = packet.payload
  const fixtureId = payload.FixtureId
  const messageId = payload.MessageId
  if (!Number.isFinite(fixtureId) || !messageId) return null

  const sourceRef = `${fixtureId}:${messageId}`
  const meta = lookup ?? undefined
  const { label, teams } = fixtureMeta(fixtureId, meta)

  return {
    id: namespacedSignalId('txodds', sourceRef),
    sourceTag: 'txodds',
    sourceRef,
    subjectType: 'match_event',
    label,
    type: oddsEventType(payload),
    value: oddsValue(payload),
    msgTimestamp: new Date(payload.Ts).toISOString(),
    ingestTimestamp,
    confidence: 1,
    matchId: String(fixtureId),
    teams,
    market: oddsMarketLabel(payload),
    verdict: 'scanning',
    rawPayload: {
      stream: 'odds',
      ...payload,
    },
    sources: ['txodds'],
    sourceCount: 1,
  }
}
