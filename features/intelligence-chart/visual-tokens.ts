/**
 * Intelligence Visualization — color is meaning, not decoration.
 * Every token maps 1:1 to an engine-derived state. Zero arbitrary palette use
 * in the Intelligence layer.
 */

export const IV = {
  /** Price context (not Intelligence meaning) */
  priceUp: '#16c784',
  priceDown: '#ea3943',
  gridLine: 'rgba(40,38,32,0.9)',
  axisText: '#8a8678',
  crosshair: 'rgba(212,175,55,0.45)',
  canvasBg: 'transparent',

  /** Conviction — Decision Engine / Explainable AI */
  convictionHigh: '#f0c14b',
  convictionMid: '#d4af37',
  convictionLow: '#5c584f',

  /** Risk severity — Security Scanner */
  riskCritical: '#ea3943',
  riskNotable: '#f5a623',
  riskInfo: '#3d8bfd',

  /** Whale pressure — Wallet Intelligence */
  whaleAccumulate: '#16c784',
  whaleDistribute: '#ea3943',
  whaleNeutral: '#9a9588',

  /** Liquidity — Market Intelligence */
  liquidity: '#3d8bfd',

  /** Holders — Wallet / Token Scanner */
  holders: '#8b5cf6',

  /** Developer actions — Security Scanner (ownership) */
  developer: '#f5a623',

  /** AI zones */
  zoneBuy: 'rgba(22,199,132,0.14)',
  zoneBuyBorder: 'rgba(22,199,132,0.35)',
  zoneSell: 'rgba(234,57,67,0.14)',
  zoneSellBorder: 'rgba(234,57,67,0.35)',

  /** Narrative annotation voice */
  narrative: '#d4af37',

  /** Instrument chrome */
  instrumentFace: '#070707',
  instrumentEdge: '#1c1c1c',
  instrumentGlow: 'rgba(212,175,55,0.22)',
} as const

export type IvToken = keyof typeof IV

/** Map severity → risk color */
export function colorForSeverity(severity: 'info' | 'notable' | 'critical'): string {
  if (severity === 'critical') return IV.riskCritical
  if (severity === 'notable') return IV.riskNotable
  return IV.riskInfo
}

/** Map layer → intelligence color */
export function colorForLayer(
  layer: 'liquidity' | 'holders' | 'developer' | 'ai' | 'security' | 'narrative' | 'price',
): string {
  switch (layer) {
    case 'liquidity':
      return IV.liquidity
    case 'holders':
      return IV.holders
    case 'developer':
      return IV.developer
    case 'ai':
      return IV.convictionMid
    case 'security':
      return IV.riskCritical
    case 'narrative':
      return IV.narrative
    default:
      return IV.axisText
  }
}

/** Conviction 0–100 → instrument color */
export function colorForConviction(n: number): string {
  if (n >= 70) return IV.convictionHigh
  if (n >= 40) return IV.convictionMid
  return IV.convictionLow
}

/** Risk 0–100 → severity color */
export function colorForRiskScore(n: number): string {
  if (n >= 70) return IV.riskCritical
  if (n >= 40) return IV.riskNotable
  return IV.riskInfo
}
