import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import { clamp, impliedProbFromDecimal } from './odds-math.js'

export type ExtractedMarket = {
  decimalOdds: number
  impliedProb: number
  market?: string
  /** True when value came from StablePrice pct (already a market view). */
  fromPct: boolean
}

/**
 * Pull decimal odds from a TxODDS-normalized UnifiedSignal.
 * Prefer StablePrice Pct (implied %) → decimal; else Prices (milli-odds or decimal).
 */
export function extractMarket(signal: UnifiedSignal): ExtractedMarket | null {
  const raw = signal.rawPayload ?? {}
  const market =
    typeof signal.market === 'string'
      ? signal.market
      : typeof raw.SuperOddsType === 'string'
        ? String(raw.SuperOddsType)
        : undefined

  // StablePrice percentage (e.g. "52.632")
  const pctArr = raw.Pct
  if (Array.isArray(pctArr) && pctArr[0] != null && pctArr[0] !== 'NA') {
    const pct = Number(pctArr[0])
    if (Number.isFinite(pct) && pct > 0 && pct < 100) {
      const impliedProb = clamp(pct / 100, 0.001, 0.999)
      return {
        decimalOdds: 1 / impliedProb,
        impliedProb,
        market,
        fromPct: true,
      }
    }
  }

  // Prices: TxLINE often uses milli-odds (2000 = 2.00)
  const prices = raw.Prices
  if (Array.isArray(prices) && typeof prices[0] === 'number') {
    const p = prices[0]
    let decimalOdds = p
    if (p >= 100) decimalOdds = p / 1000
    if (decimalOdds > 1.01 && decimalOdds < 100) {
      return {
        decimalOdds,
        impliedProb: impliedProbFromDecimal(decimalOdds),
        market,
        fromPct: false,
      }
    }
  }

  // signal.value: normalize-txodds stores pct for odds events
  if (typeof signal.value === 'number' && Number.isFinite(signal.value)) {
    const v = signal.value
    const oddsTypes = new Set(['odds_shift', 'back', 'lay'])
    if (oddsTypes.has(String(signal.type)) && v > 0 && v < 100) {
      const impliedProb = clamp(v / 100, 0.001, 0.999)
      return {
        decimalOdds: 1 / impliedProb,
        impliedProb,
        market,
        fromPct: true,
      }
    }
    if (v > 1.01 && v < 50) {
      return {
        decimalOdds: v,
        impliedProb: impliedProbFromDecimal(v),
        market,
        fromPct: false,
      }
    }
  }

  return null
}

const LATENCY_EVENT_TYPES = new Set([
  'goal',
  'red_card',
  'yellow_card',
  'score_change',
  'kickoff',
  'full_time',
])

export function isScoreLikeEvent(signal: UnifiedSignal): boolean {
  const t = String(signal.type)
  if (LATENCY_EVENT_TYPES.has(t)) return true
  const action = String(signal.rawPayload?.action ?? signal.rawPayload?.Action ?? '').toLowerCase()
  if (action.includes('goal') || action.includes('red') || action.includes('penalt')) return true
  const soccer = signal.rawPayload?.dataSoccer as Record<string, unknown> | undefined
  if (soccer?.Goal || soccer?.RedCard || soccer?.Penalty) return true
  return false
}

export function isLatencyTriggerEvent(signal: UnifiedSignal): boolean {
  const t = String(signal.type)
  if (t === 'goal' || t === 'red_card') return true
  const soccer = signal.rawPayload?.dataSoccer as Record<string, unknown> | undefined
  if (soccer?.Goal || soccer?.RedCard || soccer?.Penalty) return true
  const action = String(signal.rawPayload?.action ?? '').toLowerCase()
  return action.includes('goal') || action.includes('red') || action.includes('penalt')
}

export function latencyEventLabel(signal: UnifiedSignal): string {
  const t = String(signal.type)
  if (t === 'goal') return 'goal'
  if (t === 'red_card') return 'red card'
  const soccer = signal.rawPayload?.dataSoccer as Record<string, unknown> | undefined
  if (soccer?.Penalty) return 'penalty'
  if (soccer?.Goal) return 'goal'
  if (soccer?.RedCard) return 'red card'
  return t.replace(/_/g, ' ')
}
