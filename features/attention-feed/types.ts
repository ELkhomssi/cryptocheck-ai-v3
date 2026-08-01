/**
 * Simple Mode — Attention Feed contracts.
 * AI OS presentation layer only. No business logic — adapters reshape engine output.
 */

export type AttentionEngineId =
  | 'decision-engine'
  | 'explainable-ai'
  | 'security-scanner'
  | 'market-intelligence'
  | 'wallet-intelligence'
  | 'portfolio-intelligence'
  | 'automation-engine'
  | 'ai-coach'

export type AttentionUrgency = 'now' | 'today' | 'fyi'

export interface EvidenceRef {
  id: string
  kind: 'score' | 'metric' | 'text' | 'link'
  label: string
  value?: string | number
  detail?: string
  href?: string
}

export interface AttentionRecommendation {
  action: string
  confidence: number
}

/**
 * Core Simple Mode object — AI-ranked attention unit.
 * Progressive disclosure: Headline → Reality/Analysis → Recommendation → Evidence.
 */
export interface AttentionItem {
  id: string
  sourceEngine: AttentionEngineId
  urgency: AttentionUrgency
  /** Conclusion — always visible first */
  headline: string
  /** What happened, plainly */
  reality: string
  /** Why / what it means */
  analysis: string
  recommendation?: AttentionRecommendation
  /** Raw data — collapsed until user asks */
  evidence: EvidenceRef[]
  createdAt: string
  /** Ranking inputs (not shown in UI) */
  rankScore: number
}

export type UiPresentationMode = 'simple' | 'pro'

/** Disclosure levels — structurally enforced by AttentionCard */
export type DisclosureLevel = 0 | 1 | 2 | 3
// 0 = headline only
// 1 = + reality + analysis
// 2 = + recommendation (or skip to evidence if none)
// 3 = + evidence
