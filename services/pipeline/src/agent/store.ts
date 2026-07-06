import type { Decision, Settlement } from '@cryptocheck/signal-contracts'

export type AgentDayState = {
  dayKey: string
  realizedPnl: number
  decisionCount: number
  standDownCount: number
}

export type AgentStoreSnapshot = {
  open: Decision[]
  settled: Settlement[]
  day: AgentDayState
}

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/**
 * In-process decision ledger (MVP).
 * Prompt C will index commitments; this store is the engine's risk source of truth.
 */
export class AgentStore {
  private openById = new Map<string, Decision>()
  private openByMatch = new Map<string, Set<string>>()
  private settlements: Settlement[] = []
  private day: AgentDayState = { dayKey: utcDayKey(), realizedPnl: 0, decisionCount: 0, standDownCount: 0 }

  private rollDay(): void {
    const key = utcDayKey()
    if (this.day.dayKey !== key) {
      this.day = { dayKey: key, realizedPnl: 0, decisionCount: 0, standDownCount: 0 }
    }
  }

  getDay(): AgentDayState {
    this.rollDay()
    return { ...this.day }
  }

  markStandDown(): void {
    this.rollDay()
    this.day.standDownCount += 1
  }

  addDecision(decision: Decision): void {
    this.rollDay()
    this.openById.set(decision.id, decision)
    let set = this.openByMatch.get(decision.matchId)
    if (!set) {
      set = new Set()
      this.openByMatch.set(decision.matchId, set)
    }
    set.add(decision.id)
    this.day.decisionCount += 1
  }

  getOpen(decisionId: string): Decision | undefined {
    return this.openById.get(decisionId)
  }

  listOpenForMatch(matchId: string): Decision[] {
    const set = this.openByMatch.get(matchId)
    if (!set) return []
    return [...set].map((id) => this.openById.get(id)).filter((d): d is Decision => Boolean(d))
  }

  openExposureForMatch(matchId: string): number {
    return this.listOpenForMatch(matchId).reduce((sum, d) => sum + d.size, 0)
  }

  addSettlement(settlement: Settlement, decision: Decision): void {
    this.rollDay()
    this.openById.delete(decision.id)
    const set = this.openByMatch.get(decision.matchId)
    if (set) {
      set.delete(decision.id)
      if (set.size === 0) this.openByMatch.delete(decision.matchId)
    }
    this.settlements.push(settlement)
    if (this.settlements.length > 500) this.settlements = this.settlements.slice(-500)
    this.day.realizedPnl += settlement.realizedPnl
  }

  snapshot(): AgentStoreSnapshot {
    this.rollDay()
    return {
      open: [...this.openById.values()],
      settled: [...this.settlements],
      day: { ...this.day },
    }
  }
}
