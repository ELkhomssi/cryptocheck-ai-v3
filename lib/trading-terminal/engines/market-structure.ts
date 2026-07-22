/**
 * Market structure engine — swing highs/lows, BOS, CHOCH.
 * Pure candle math. Labels are structural detections, not trade signals.
 */

import type { Candle } from '../ohlcv-feed'

export type StructureBias = 'bullish' | 'bearish' | 'neutral'

export type StructureLabelKind = 'HH' | 'HL' | 'LH' | 'LL' | 'BOS' | 'CHOCH'

export type StructureLabel = {
  time: number
  price: number
  kind: StructureLabelKind
  bias: StructureBias
  /** Short chart marker text */
  text: string
}

export type MarketStructureResult = {
  bias: StructureBias
  labels: StructureLabel[]
  /** Last confirmed swing high / low for zone overlays */
  lastSwingHigh: { time: number; price: number } | null
  lastSwingLow: { time: number; price: number } | null
  method: 'market-structure-v1'
}

const DEFAULT_LOOKBACK = 3

function isSwingHigh(candles: Candle[], i: number, lb: number): boolean {
  const h = candles[i]!.high
  for (let j = i - lb; j <= i + lb; j++) {
    if (j === i || j < 0 || j >= candles.length) continue
    if (candles[j]!.high >= h) return false
  }
  return true
}

function isSwingLow(candles: Candle[], i: number, lb: number): boolean {
  const l = candles[i]!.low
  for (let j = i - lb; j <= i + lb; j++) {
    if (j === i || j < 0 || j >= candles.length) continue
    if (candles[j]!.low <= l) return false
  }
  return true
}

/**
 * Detect swing structure + Break of Structure / Change of Character.
 * Requires enough bars; thin series → empty labels, neutral bias.
 */
export function detectMarketStructure(
  candles: Candle[],
  lookback: number = DEFAULT_LOOKBACK,
): MarketStructureResult {
  if (candles.length < lookback * 2 + 5) {
    return {
      bias: 'neutral',
      labels: [],
      lastSwingHigh: null,
      lastSwingLow: null,
      method: 'market-structure-v1',
    }
  }

  type Swing = { time: number; price: number; type: 'high' | 'low'; idx: number }
  const swings: Swing[] = []
  for (let i = lookback; i < candles.length - lookback; i++) {
    if (isSwingHigh(candles, i, lookback)) {
      swings.push({ time: candles[i]!.time, price: candles[i]!.high, type: 'high', idx: i })
    }
    if (isSwingLow(candles, i, lookback)) {
      swings.push({ time: candles[i]!.time, price: candles[i]!.low, type: 'low', idx: i })
    }
  }
  swings.sort((a, b) => a.idx - b.idx)

  const labels: StructureLabel[] = []
  let lastHigh: Swing | null = null
  let lastLow: Swing | null = null

  for (const s of swings) {
    if (s.type === 'high') {
      if (lastHigh) {
        const kind: StructureLabelKind = s.price > lastHigh.price ? 'HH' : 'LH'
        labels.push({
          time: s.time,
          price: s.price,
          kind,
          bias: kind === 'HH' ? 'bullish' : 'bearish',
          text: kind,
        })
      }
      lastHigh = s
    } else {
      if (lastLow) {
        const kind: StructureLabelKind = s.price > lastLow.price ? 'HL' : 'LL'
        labels.push({
          time: s.time,
          price: s.price,
          kind,
          bias: kind === 'HL' ? 'bullish' : 'bearish',
          text: kind,
        })
      }
      lastLow = s
    }
  }

  // Running bias from swing sequence
  let structBias: StructureBias = 'neutral'
  let sh: Swing | null = null
  let sl: Swing | null = null
  for (const s of swings) {
    if (s.type === 'high') {
      if (sh && s.price > sh.price) structBias = 'bullish'
      else if (sh && s.price < sh.price && structBias !== 'bullish') structBias = 'bearish'
      sh = s
    } else {
      if (sl && s.price < sl.price) structBias = 'bearish'
      else if (sl && s.price > sl.price && structBias !== 'bearish') structBias = 'bullish'
      sl = s
    }
  }

  const bosChoch: StructureLabel[] = []
  const startIdx = Math.max(sh?.idx ?? lookback, sl?.idx ?? lookback) + 1
  let bosEmitted = false
  let chochEmitted = false
  let liveBias = structBias

  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i]!
    if (!bosEmitted && liveBias === 'bullish' && sh && c.close > sh.price) {
      bosChoch.push({
        time: c.time,
        price: c.close,
        kind: 'BOS',
        bias: 'bullish',
        text: 'BOS',
      })
      bosEmitted = true
    }
    if (!bosEmitted && liveBias === 'bearish' && sl && c.close < sl.price) {
      bosChoch.push({
        time: c.time,
        price: c.close,
        kind: 'BOS',
        bias: 'bearish',
        text: 'BOS',
      })
      bosEmitted = true
    }
    if (!chochEmitted && liveBias === 'bullish' && sl && c.close < sl.price) {
      bosChoch.push({
        time: c.time,
        price: c.close,
        kind: 'CHOCH',
        bias: 'bearish',
        text: 'CHoCH',
      })
      chochEmitted = true
      liveBias = 'bearish'
    }
    if (!chochEmitted && liveBias === 'bearish' && sh && c.close > sh.price) {
      bosChoch.push({
        time: c.time,
        price: c.close,
        kind: 'CHOCH',
        bias: 'bullish',
        text: 'CHoCH',
      })
      chochEmitted = true
      liveBias = 'bullish'
    }
  }

  const swingLabels = labels.slice(-6)
  const merged = [...swingLabels, ...bosChoch].sort((a, b) => a.time - b.time)

  return {
    bias: liveBias,
    labels: merged,
    lastSwingHigh: sh ? { time: sh.time, price: sh.price } : null,
    lastSwingLow: sl ? { time: sl.time, price: sl.price } : null,
    method: 'market-structure-v1',
  }
}
