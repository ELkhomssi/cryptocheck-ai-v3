import { BANNED_HYPE } from '@/lib/scout/strategy'
import type { QualityReport, ScoutArticleDraft } from '@/lib/scout/types'

const EDUCATE_HEADINGS = [
  /real problem/i,
  /current tools fail/i,
  /professionals solve/i,
  /cryptocheckai solves/i,
  /terminal os/i,
  /next step/i,
]

/**
 * Deterministic quality gates — no article publishes until all pass.
 * V2 adds no-hype, ecosystem focus, and educate-first structure checks.
 */
export function reviewArticleQuality(
  draft: ScoutArticleDraft,
  opts?: { existingSlugs?: string[] },
): QualityReport {
  const checks: QualityReport['checks'] = []

  const text = [
    draft.title,
    draft.introduction,
    draft.marketContext,
    draft.technicalAnalysis,
    draft.securityAnalysis,
    draft.cryptocheckIntelligence,
    draft.conclusion,
    ...draft.sections.map((s) => `${s.heading}\n${s.body}`),
  ].join('\n')

  checks.push({
    id: 'grammar',
    passed: text.length > 400 && !/\b(asdf|lorem ipsum)\b/i.test(text),
    detail: 'Basic length + placeholder scan',
  })

  checks.push({
    id: 'seo',
    passed:
      draft.title.length >= 20 &&
      draft.title.length <= 90 &&
      draft.keywords.length >= 2 &&
      Boolean(draft.metaTitle) &&
      Boolean(draft.metaDescription) &&
      draft.metaDescription.length >= 80,
    detail: `Title ${draft.title.length}; metaDesc ${draft.metaDescription?.length ?? 0}; keywords ${draft.keywords.length}`,
  })

  const words = text.split(/\s+/).filter(Boolean).length
  checks.push({
    id: 'readability',
    passed: words >= 280 && words <= 3500,
    detail: `Word count ${words}`,
  })

  const slugClash = opts?.existingSlugs?.includes(draft.slug) ?? false
  checks.push({
    id: 'duplicate',
    passed: draft.engineCitations.length > 0 && !slugClash,
    detail: slugClash
      ? 'Slug already published'
      : 'Requires engine citation fingerprints (anti-empty / anti-generic spam)',
  })

  checks.push({
    id: 'eeat',
    passed:
      draft.sources.length >= 1 &&
      /cryptocheck|scanner|gateway|terminal os|market/i.test(draft.cryptocheckIntelligence),
    detail: 'EEAT: sources + engine attribution present',
  })

  checks.push({
    id: 'technical_accuracy',
    passed: !/guaranteed profit|risk-free|100% safe/i.test(text),
    detail: 'Blocks clickbait certainty language',
  })

  checks.push({
    id: 'no_hype',
    passed: !BANNED_HYPE.test(text),
    detail: 'Blocks hype / profit-promise vocabulary',
  })

  checks.push({
    id: 'ecosystem_focus',
    passed:
      /terminal os/i.test(text) &&
      (/intelligence chart|ai gateway|security scanner|ai coaching|trade like me|portfolio intelligence|discovery engine|secure execution|decision/i.test(
        text,
      ) ||
        Boolean(draft.pillar)),
    detail: 'Must reinforce Terminal OS + at least one ecosystem surface',
  })

  const headingBlob = draft.sections.map((s) => s.heading).join(' | ')
  const structureHits = EDUCATE_HEADINGS.filter((re) => re.test(headingBlob)).length
  checks.push({
    id: 'educate_structure',
    passed: structureHits >= 4 && draft.sections.length >= 6,
    detail: `Educate-first headings matched ${structureHits}/6; sections ${draft.sections.length}`,
  })

  checks.push({
    id: 'factual_consistency',
    passed:
      !draft.mint ||
      draft.technicalAnalysis.includes(draft.mint) ||
      draft.securityAnalysis.includes('scan-gateway') ||
      draft.securityAnalysis.includes(draft.mint) ||
      draft.sections.some((s) => s.body.includes(draft.mint!)),
    detail: 'Mint topics must mention mint or explicit scan-gateway caveat',
  })

  checks.push({
    id: 'internal_links',
    passed:
      draft.internalLinks.length >= 4 &&
      draft.internalLinks.some((l) => l.href === '/terminalOS' || l.href === '/app'),
    detail: `Internal links ${draft.internalLinks.length}; Terminal OS link required`,
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
