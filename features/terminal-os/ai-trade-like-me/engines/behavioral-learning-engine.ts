/**
 * Behavioral Learning Engine — records trades + context.
 * Learns WHY entered / exited, HOW risk managed — never copies trades.
 */

import type { CapturedTrade } from '../types'
import type { TlmEventBus } from './event-bus'

const MIN_TRADES_FOR_DNA = 8

export function getMinTradesForDna(): number {
  return MIN_TRADES_FOR_DNA
}

export class BehavioralLearningEngine {
  private trades = new Map<string, CapturedTrade>()
  private recording = false
  private wallet: string | null = null

  constructor(private readonly bus: TlmEventBus) {}

  startRecording(wallet: string) {
    this.wallet = wallet
    this.recording = true
    this.bus.publish('tlm.session.started', { wallet }, 'BehavioralLearningEngine')
  }

  stopRecording() {
    this.recording = false
    this.bus.publish(
      'tlm.session.stopped',
      { wallet: this.wallet, tradeCount: this.trades.size },
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
    this.bus.publish('tlm.trade.recorded', { id: trade.id, side: trade.side }, 'BehavioralLearningEngine')
  }

  recordMany(trades: CapturedTrade[]) {
    for (const t of trades) this.recordTrade(t)
  }

  teachNote(note: string) {
    this.bus.publish('tlm.teach.note', { note, wallet: this.wallet }, 'BehavioralLearningEngine')
  }

  listTrades(): CapturedTrade[] {
    return Array.from(this.trades.values()).sort(
      (a, b) => new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime(),
    )
  }

  learningProgressPct(): number {
    const n = this.trades.size
    if (n === 0) return 0
    return Math.min(100, Math.round((n / MIN_TRADES_FOR_DNA) * 100))
  }

  hasSufficientHistory(): boolean {
    return this.trades.size >= MIN_TRADES_FOR_DNA
  }

  hydrate(trades: CapturedTrade[], wallet: string | null) {
    this.trades.clear()
    this.wallet = wallet
    for (const t of trades) this.trades.set(t.id, t)
  }
}
