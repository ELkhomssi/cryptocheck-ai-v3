/**
 * Lightweight scam / low-quality heuristics for discovery enrollment.
 * Does NOT replace Sentinel scan — only filters obviously toxic channel metadata.
 */

const SCAM_LABEL_RE =
  /\b(100x|guaranteed|airdrop\s*claim|free\s*mint|dm\s*admin|seed\s*phrase|private\s*key|double\s*your|giveaway\s*bot|connect\s*wallet\s*now)\b/i

const LOW_SIGNAL_RE = /\b(forex|binary\s*options|nft\s*whitelist\s*only)\b/i

export type DiscoveryHygieneResult = {
  ok: boolean
  reason?: string
}

/** Reject candidate labels/handles that scream scam or off-domain spam. */
export function passesDiscoveryHygiene(input: {
  handle: string
  label?: string
  audienceSize?: number
  minAudience?: number
}): DiscoveryHygieneResult {
  const text = `${input.handle} ${input.label ?? ''}`
  if (SCAM_LABEL_RE.test(text)) {
    return { ok: false, reason: 'scam_keyword_in_label' }
  }
  if (LOW_SIGNAL_RE.test(text)) {
    return { ok: false, reason: 'off_domain_keyword' }
  }
  const minAud = input.minAudience ?? 0
  if (typeof input.audienceSize === 'number' && input.audienceSize < minAud) {
    return { ok: false, reason: 'audience_below_floor' }
  }
  return { ok: true }
}

/**
 * Score a sample of recent message texts for CA density vs scam bait.
 * Returns engagement-ish 0..100 used as discovery prior (not user-facing).
 */
export function scoreMessageSample(texts: string[]): number {
  if (texts.length === 0) return 50
  let caHits = 0
  let scamHits = 0
  const caRe = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b|0x[a-fA-F0-9]{40}/
  for (const t of texts) {
    if (caRe.test(t)) caHits += 1
    if (SCAM_LABEL_RE.test(t)) scamHits += 1
  }
  const caRate = caHits / texts.length
  const scamRate = scamHits / texts.length
  // Prefer channels that actually post contracts without scam bait.
  const raw = 40 + 50 * caRate - 60 * scamRate
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100
}
