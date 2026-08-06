import type { KeywordOpportunity, ScoutTopic, SearchIntent } from '@/lib/scout/types'

function inferIntent(title: string): SearchIntent {
  const t = title.toLowerCase()
  if (/(buy|price|swap|trade)/.test(t)) return 'transactional'
  if (/(vs|best|pricing|review)/.test(t)) return 'commercial'
  if (/(login|dashboard|terminal)/.test(t)) return 'navigational'
  return 'informational'
}

/**
 * Keyword intelligence without fabricating Search Console volumes.
 * V2 biases keywords toward Terminal OS + ecosystem pillars.
 */
export function rankKeywordOpportunities(topics: ScoutTopic[]): KeywordOpportunity[] {
  const out: KeywordOpportunity[] = []

  for (const topic of topics) {
    const pillarLabel = topic.pillar?.replace(/_/g, ' ') || 'terminal os'
    const base = (topic.symbol || topic.title).replace(/[^\w\s.-]/g, '').trim()
    const primary =
      topic.source === 'ecosystem-pillar'
        ? `${pillarLabel} cryptocheckai terminal os`.toLowerCase()
        : `${base} terminal os security`.toLowerCase()

    const related = [
      'terminal os crypto',
      'ai gateway cryptocheckai',
      'intelligence chart trading',
      `${base} security scanner`,
      'decision intelligence crypto',
    ]
    const longTail = [
      `what is cryptocheckai terminal os`,
      `how does ${pillarLabel} work in terminal os`,
      `ai coaching vs signal feeds crypto`,
    ]
    const semanticKeywords = [
      'on-chain intelligence',
      'portfolio automation',
      'capital rotation',
      'market psychology',
      'secure execution',
      'whale intelligence',
    ]
    const paa = [
      'What is Terminal OS?',
      `How does CryptoCheckAI approach ${pillarLabel}?`,
      'Is CryptoCheckAI Scout financial advice?',
    ]

    let kd = 42
    if (topic.source === 'new-launches') kd = 58
    if (topic.source === 'scan-gateway') kd = 36
    if (topic.source === 'market-analyst') kd = 48
    if (topic.source === 'ecosystem-pillar') kd = 40

    const opportunityScore = Math.max(
      1,
      Math.min(
        100,
        100 -
          kd +
          (topic.mint ? 6 : 0) +
          (topic.source === 'ecosystem-pillar' ? 14 : 0) +
          (topic.source.includes('trending') ? 8 : 0) +
          Math.round((topic.priorityScore ?? 50) * 0.1),
      ),
    )

    out.push({
      keyword: primary,
      topicId: topic.id,
      searchVolume: null,
      keywordDifficulty: kd,
      intent: inferIntent(primary),
      relatedKeywords: related,
      longTail,
      semanticKeywords,
      peopleAlsoAsk: paa,
      opportunityScore,
      method: 'heuristic',
      notes:
        'Search volume unavailable — no SEO provider configured. Difficulty is a heuristic from topic class, not a third-party metric.',
    })
  }

  return out.sort((a, b) => b.opportunityScore - a.opportunityScore)
}
