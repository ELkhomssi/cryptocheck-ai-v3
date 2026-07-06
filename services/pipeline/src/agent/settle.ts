import type { Decision, Settlement, SettlementOutcome, UnifiedSignal } from '@cryptocheck/signal-contracts'
import { hashSettlementInputs } from './data-hash.js'
import { signCommitment } from './sign.js'

function isFullTime(signal: UnifiedSignal): boolean {
  if (String(signal.type) === 'full_time') return true
  const state = String(signal.rawPayload?.gameState ?? signal.market ?? '').toUpperCase()
  return state === 'F' || state === 'FET' || state === 'FPE'
}

export function shouldSettle(signal: UnifiedSignal): boolean {
  return signal.subjectType === 'match_event' && isFullTime(signal)
}

/**
 * Simple settlement model for paper track record:
 * - back @ entryOdds: win → size * (odds - 1), lose → -size
 * - lay: inverse
 * - home/away: compare final score
 * - unknown: void
 */
export function resolveOutcome(
  decision: Decision,
  signal: UnifiedSignal,
): { outcome: SettlementOutcome; realizedPnl: number } {
  const score = signal.score
  const odds = decision.entryOdds > 1 ? decision.entryOdds : decision.edgeSignal.marketValue
  const stake = decision.size

  if (decision.side === 'unknown' || !Number.isFinite(odds) || odds <= 1) {
    return { outcome: 'void', realizedPnl: 0 }
  }

  if (decision.side === 'home' || decision.side === 'away') {
    if (!score) return { outcome: 'void', realizedPnl: 0 }
    if (score.home === score.away) return { outcome: 'push', realizedPnl: 0 }
    const homeWon = score.home > score.away
    const won =
      (decision.side === 'home' && homeWon) || (decision.side === 'away' && !homeWon)
    return won
      ? { outcome: 'win', realizedPnl: stake * (odds - 1) }
      : { outcome: 'lose', realizedPnl: -stake }
  }

  if (decision.side === 'back') {
    // Without explicit selection result, use score if present: favorite (shorter odds) = home heuristic
    if (!score) return { outcome: 'void', realizedPnl: 0 }
    if (score.home === score.away) return { outcome: 'push', realizedPnl: 0 }
    // Prefer home when we backed a favorite (fair < market often home-leaning in our model)
    const won = score.home > score.away
    return won
      ? { outcome: 'win', realizedPnl: stake * (odds - 1) }
      : { outcome: 'lose', realizedPnl: -stake }
  }

  if (decision.side === 'lay') {
    if (!score) return { outcome: 'void', realizedPnl: 0 }
    if (score.home === score.away) return { outcome: 'push', realizedPnl: 0 }
    const homeWon = score.home > score.away
    // Lay home-favorite: win when home does not win
    const won = !homeWon
    return won
      ? { outcome: 'win', realizedPnl: stake * (1 - 1 / odds) }
      : { outcome: 'lose', realizedPnl: -stake * (odds - 1) }
  }

  return { outcome: 'void', realizedPnl: 0 }
}

export function buildSettlement(
  decision: Decision,
  signal: UnifiedSignal,
): Settlement {
  const { outcome, realizedPnl } = resolveOutcome(decision, signal)
  const settledAt = signal.msgTimestamp || new Date().toISOString()
  const dataHash = hashSettlementInputs({
    decisionId: decision.id,
    outcome,
    realizedPnl,
    finalScore: signal.score,
  })

  const settlement: Settlement = {
    id: `stl_${decision.id}`,
    decisionId: decision.id,
    agentId: decision.agentId,
    matchId: decision.matchId,
    outcome,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    settledAt,
    finalScore: signal.score,
    dataHash,
    mode: decision.mode,
  }

  const signed = signCommitment({
    id: settlement.id,
    decisionId: settlement.decisionId,
    outcome: settlement.outcome,
    realizedPnl: settlement.realizedPnl,
    dataHash: settlement.dataHash,
    settledAt: settlement.settledAt,
  })
  if (signed) {
    settlement.signature = signed.signature
    settlement.signedAt = signed.signedAt
  }

  return settlement
}
