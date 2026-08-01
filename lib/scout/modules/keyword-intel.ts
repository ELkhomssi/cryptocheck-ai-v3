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
 * Scores opportunities heuristically from live topic evidence.
 * When a real SEO provider is wired later, set method: 'provider' + real volume.
 */
export function rankKeywordOpportunities(topics: ScoutTopic[]): KeywordOpportunity[] {
  const out: KeywordOpportunity[] = []

  for (const topic of topics) {
    const base = (topic.symbol || topic.title).replace(/[^\w\s.-]/g, '').trim()
    const primary = `${base} solana security scan`.toLowerCase()
    const related = [
      `${base} rug check`,
      `${base} token scanner`,
      `solana ${base} analysis`,
      'crypto AI scanner',
      'wallet analysis solana',
    ]
    const longTail = [
      `how to scan ${base} on solana`,
      `${base} safety score cryptocheckai`,
      `is ${base} safe crypto check`,
    ]
    const paa = [
      `What is the risk profile of ${base}?`,
      `How does CryptoCheckAI score ${base}?`,
      `Where can I analyze ${base} on Solana?`,
    ]

    // Heuristic difficulty: launch topics harder; market brief mid; trending mid-low
    let kd = 45
    if (topic.source === 'new-launches') kd = 62
    if (topic.source === 'scan-gateway') kd = 38
    if (topic.source === 'market-analyst') kd = 50

    const opportunityScore = Math.max(
      1,
      Math.min(100, 100 - kd + (topic.mint ? 8 : 0) + (topic.source.includes('trending') ? 10 : 0)),
    )

    out.push({
      keyword: primary,
      topicId: topic.id,
      searchVolume: null,
      keywordDifficulty: kd,
      intent: inferIntent(primary),
      relatedKeywords: related,
      longTail,
      peopleAlsoAsk: paa,
      opportunityScore,
      method: 'heuristic',
      notes:
        'Search volume unavailable — no SEO provider configured. Difficulty is a heuristic from topic class, not a third-party metric.',
    })
  }

  return out.sort((a, b) => b.opportunityScore - a.opportunityScore)
}
