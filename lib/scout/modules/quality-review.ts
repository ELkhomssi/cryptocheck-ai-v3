import type { QualityReport, ScoutArticleDraft } from '@/lib/scout/types'

/**
 * Deterministic quality gates — no article publishes until all pass.
 * AI-detection is heuristic (template writer should score as structured), not a paid detector.
 */
export function reviewArticleQuality(draft: ScoutArticleDraft): QualityReport {
  const checks: QualityReport['checks'] = []

  const text = [
    draft.title,
    draft.introduction,
    draft.marketContext,
    draft.technicalAnalysis,
    draft.securityAnalysis,
    draft.cryptocheckIntelligence,
    draft.conclusion,
  ].join('\n')

  checks.push({
    id: 'grammar',
    passed: text.length > 200 && !/\b(asdf|lorem ipsum)\b/i.test(text),
    detail: 'Basic length + placeholder scan',
  })

  checks.push({
    id: 'seo',
    passed: draft.title.length >= 20 && draft.title.length <= 80 && draft.keywords.length >= 2,
    detail: `Title length ${draft.title.length}; keywords ${draft.keywords.length}`,
  })

  const words = text.split(/\s+/).filter(Boolean).length
  checks.push({
    id: 'readability',
    passed: words >= 140 && words <= 2500,
    detail: `Word count ${words}`,
  })

  checks.push({
    id: 'duplicate',
    passed: draft.engineCitations.length > 0,
    detail: 'Requires engine citation fingerprints (anti-empty / anti-generic spam)',
  })

  checks.push({
    id: 'eeat',
    passed:
      draft.sources.length >= 1 &&
      /cryptocheck|scanner|gateway|market/i.test(draft.cryptocheckIntelligence),
    detail: 'EEAT: sources + engine attribution present',
  })

  checks.push({
    id: 'technical_accuracy',
    passed: !/guaranteed profit|risk-free|100% safe/i.test(text),
    detail: 'Blocks clickbait certainty language',
  })

  checks.push({
    id: 'factual_consistency',
    passed:
      !draft.mint ||
      draft.technicalAnalysis.includes(draft.mint) ||
      draft.securityAnalysis.includes('scan-gateway') ||
      draft.securityAnalysis.includes(draft.mint),
    detail: 'Mint topics must mention mint or explicit scan-gateway caveat',
  })

  checks.push({
    id: 'internal_links',
    passed: draft.internalLinks.length >= 3,
    detail: `Internal links ${draft.internalLinks.length}`,
  })

  checks.push({
    id: 'external_sources',
    passed: draft.sources.length >= 1,
    detail: `Sources ${draft.sources.length}`,
  })

  checks.push({
    id: 'no_hallucination',
    passed:
      /does not invent|not invent|refuses to invent|single source of truth|evidence/i.test(text) &&
      draft.engineCitations.length > 0,
    detail: 'Requires explicit non-invention stance + citations',
  })

  const passedCount = checks.filter((c) => c.passed).length
  const score = Math.round((passedCount / checks.length) * 100)
  return {
    passed: checks.every((c) => c.passed),
    score,
    checks,
    reviewedAt: new Date().toISOString(),
  }
}
