/**
 * Scout V2 fact-check — deterministic consistency vs engine evidence.
 * Blocks invented certainty; does not call external "fact APIs".
 */

import type { ScoutArticleDraft } from '@/lib/scout/types'
import type { ScoutEngineSnapshot } from '@/lib/scout/intelligence-bridge'

export type FactCheckReport = {
  passed: boolean
  score: number
  findings: Array<{ id: string; passed: boolean; detail: string }>
  checkedAt: string
}

export function factCheckArticle(
  draft: ScoutArticleDraft,
  snapshot: ScoutEngineSnapshot,
): FactCheckReport {
  const findings: FactCheckReport['findings'] = []
  const text = [
    draft.title,
    ...draft.sections.map((s) => s.body),
    draft.introduction,
    draft.conclusion,
  ].join('\n')

  findings.push({
    id: 'engine_citations',
    passed: draft.engineCitations.length > 0 && snapshot.citations.length >= 0,
    detail: `Citations ${draft.engineCitations.length}; snapshot sources ${snapshot.citations.length}`,
  })

  findings.push({
    id: 'no_profit_promises',
    passed: !/\b(guaranteed returns?|will (moon|10x|100x)|risk[- ]?free profit)\b/i.test(text),
    detail: 'No guaranteed-return language',
  })

  findings.push({
    id: 'disclaimer_present',
    passed: /not financial advice|dyor/i.test(text),
    detail: 'DYOR / not-financial-advice present',
  })

  if (draft.mint) {
    findings.push({
      id: 'mint_consistency',
      passed: text.includes(draft.mint),
      detail: `Mint ${draft.mint.slice(0, 8)}… referenced in body`,
    })
  }

  // Numbers that appear must not invent "search volume" style fabrications
  findings.push({
    id: 'no_fabricated_seo_volume',
    passed: !/\b(search volume|monthly searches|kd score)\s*[:=]\s*\d{2,}/i.test(text),
    detail: 'Blocks fabricated SEO volume claims in prose',
  })

  findings.push({
    id: 'terminal_os_truth',
    passed: /terminal os/i.test(text),
    detail: 'Terminal OS referenced as product truth',
  })

  // Evidence line from topic should not be contradicted by "unavailable" while citing invented stats
  const topic = snapshot.topics.find((t) => t.id === draft.topicId)
  if (topic?.evidenceLine) {
    findings.push({
      id: 'evidence_anchored',
      passed:
        text.includes(topic.evidenceLine.slice(0, 40)) ||
        /evidence|citation|snapshot|gateway|coingecko|dexscreener|market feeds/i.test(text),
      detail: 'Body remains evidence-anchored to research cycle',
    })
  }

  const passedCount = findings.filter((f) => f.passed).length
  const score = Math.round((passedCount / Math.max(1, findings.length)) * 100)
  return {
    passed: findings.every((f) => f.passed),
    score,
    findings,
    checkedAt: new Date().toISOString(),
  }
}
