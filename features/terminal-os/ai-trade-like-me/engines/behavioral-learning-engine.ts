/**
 * Behavioral Learning Engine V2 — records trades + rejected opportunities.
 * Read-permission only at train stage (never write/execute).
 */

import type { CapturedTrade } from '../types'
import type { TlmEventBus } from './event-bus'

const MIN_SAMPLES_FOR_DNA = 8

export function getMinTradesForDna(): number {
  return MIN_SAMPLES_FOR_DNA
}

/** Pure progress helper — sampleSize vs threshold for baseline DNA confidence. */
export function learningProgressFromSampleSize(sampleSize: number): number {
  if (sampleSize <= 0) return 0
  return Math.min(100, Math.round((sampleSize / MIN_SAMPLES_FOR_DNA) * 100))
}

export { MIN_SAMPLES_FOR_DNA }

export class BehavioralLearningEngine {
  private trades = new Map<string, CapturedTrade>()
  private recording = false
  private wallet: string | null = null

  constructor(private readonly bus: TlmEventBus) {}

  startRecording(wallet: string) {
    this.wallet = wallet
    this.recording = true
    this.bus.publish('SessionStarted', { wallet, permission: 'read_only' }, 'BehavioralLearningEngine')
    this.bus.publish('tlm.session.started', { wallet }, 'BehavioralLearningEngine')
  }

  stopRecording() {
    this.recording = false
    this.bus.publish(
      'SessionStopped',
      { wallet: this.wallet, sampleSize: this.trades.size },
      'BehavioralLearningEngine',
    )
  }

  isRecording() {
    return this.recording
  }

  getWallet() {
    return this.wallet
  }

  recordTrade(trade: CapturedTrade) {
    if (this.wallet && trade.wallet !== this.wallet) return
    this.trades.set(trade.id, trade)
    if (trade.wasRejectedOpportunity) {
      this.bus.publish(
        'RejectionRecorded',
        { id: trade.id, reason: trade.rejectionReasonInferred ?? null },
        'BehavioralLearningEngine',
      )
    } else {
      this.bus.publish(
        'TradeRecorded',
        { id: trade.id, side: trade.side, symbol: trade.token.symbol },
        'BehavioralLearningEngine',
      )
    }
  }

  recordMany(trades: CapturedTrade[]) {
    for (const t of trades) this.recordTrade(t)
  }

  teachNote(note: string) {
    this.bus.publish('TeachNote', { note, wallet: this.wallet }, 'BehavioralLearningEngine')
  }

  listTrades(): CapturedTrade[] {
    return Array.from(this.trades.values()).sort(
      (a, b) => new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime(),
    )
  }

  learningProgressPct(): number {
    return learningProgressFromSampleSize(this.trades.size)
  }

  hasSufficientHistory(): boolean {
    return this.trades.size >= MIN_SAMPLES_FOR_DNA
  }

  hydrate(trades: CapturedTrade[], wallet: string | null) {
    this.trades.clear()
    this.wallet = wallet
    for (const t of trades) this.trades.set(t.id, t)
  }
}
