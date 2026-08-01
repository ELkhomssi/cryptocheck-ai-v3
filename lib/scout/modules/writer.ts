import { createHash, randomUUID } from 'crypto'
import { SCOUT_DISCLAIMER, SCOUT_INTERNAL_LINKS } from '@/lib/scout/constants'
import type { KeywordOpportunity, ScoutArticleDraft, ScoutTopic } from '@/lib/scout/types'
import type { ScoutEngineSnapshot } from '@/lib/scout/intelligence-bridge'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/**
 * Professional Writer — template composition from engine snapshots only.
 * Does not invent prices, verdicts, or whale stats.
 */
export function writeArticleFromEngines(input: {
  topic: ScoutTopic
  keyword?: KeywordOpportunity | null
  snapshot: ScoutEngineSnapshot
}): ScoutArticleDraft {
  const { topic, keyword, snapshot } = input
  const now = new Date().toISOString()
  const symbol = topic.symbol || 'the asset'
  const title = topic.mint
    ? `${symbol} Solana Security & Market Context — CryptoCheckAI Scout`
    : `${topic.title} — CryptoCheckAI Growth Brief`

  const slugBase = slugify(`${symbol}-${topic.source}-${topic.id.slice(-6)}`)
  const slug = slugBase || `scout-${randomUUID().slice(0, 8)}`

  const marketContext =
    snapshot.marketBriefSummary ||
    `Market context is limited to live feed evidence: ${topic.evidenceLine}. When the Market Analyst brief is unavailable, Scout does not invent a macro narrative.`

  const technicalAnalysis = topic.mint
    ? `Technical / listing context for mint \`${topic.mint}\` is grounded in CryptoCheckAI market feeds (${topic.source}). Evidence: ${topic.evidenceLine}. Chart surfaces remain available in Terminal OS Intelligence Chart — Scout does not fabricate OHLC.`
    : `No single mint is attached to this topic. Technical claims are restricted to aggregate feed evidence: ${topic.evidenceLine}.`

  const securityAnalysis =
    topic.source === 'scan-gateway'
      ? `Security analysis cites the scan gateway assessment only. ${topic.narrative} Evidence: ${topic.evidenceLine}. DANGER/HIGH_RISK language follows gateway verdicts — never upgraded for engagement.`
      : `No dedicated scan-gateway run is attached to this draft. Use Terminal OS Scanner or link a mint before publishing security claims. Scout refuses to invent honeypot / authority findings.`

  const cryptocheckIntelligence = [
    'CryptoCheckAI remains the single source of truth for risk, market, and wallet intelligence.',
    `Citations for this draft: ${snapshot.citations.join(', ') || 'none'}.`,
    snapshot.marketBriefSources.length
      ? `Market analyst sources note: ${snapshot.marketBriefSources.join(' · ')}.`
      : 'Market analyst sources note: unavailable for this cycle.',
    'Readers should open Scanner, Terminal OS, token pages, and wallet pages for live state — Scout articles are time-bounded snapshots, not continuous quotes.',
    'Internal distribution (X, LinkedIn, Telegram, Discord, newsletter) is rewritten per channel after quality review — never blindly copied.',
  ].join(' ')

  const faq = [
    {
      question: `What does CryptoCheckAI say about ${symbol}?`,
      answer: `${topic.narrative} This is derived from ${topic.source} evidence, not social speculation.`,
    },
    {
      question: 'Is this financial advice?',
      answer: SCOUT_DISCLAIMER,
    },
    {
      question: 'Where can I re-scan or dig deeper?',
      answer: topic.mint
        ? `Open the Security Scanner with mint ${topic.mint}, or visit the public token page /token/${topic.mint}.`
        : 'Open Terminal OS → AI Scanner / Market Intel for live desks.',
    },
  ]

  const internalLinks = [
    ...SCOUT_INTERNAL_LINKS.map((l) => ({ href: l.href, anchor: l.anchor })),
    ...(topic.mint
      ? [
          { href: `/token/${topic.mint}`, anchor: `${symbol} token page` },
          { href: `/scanner?mint=${encodeURIComponent(topic.mint)}`, anchor: `Scan ${symbol}` },
        ]
      : []),
  ]

  const sections = [
    { heading: 'Introduction', body: topic.narrative },
    { heading: 'Market Context', body: marketContext },
    { heading: 'Technical Analysis', body: technicalAnalysis },
    { heading: 'Security Analysis', body: securityAnalysis },
    { heading: 'CryptoCheckAI Intelligence', body: cryptocheckIntelligence },
    {
      heading: 'Conclusion',
      body: `Scout publishes only what CryptoCheckAI engines observed at ${snapshot.gatheredAt}. Re-run feeds before acting. ${SCOUT_DISCLAIMER}`,
    },
  ]

  const engineCitations = snapshot.citations.map(
    (c) => createHash('sha256').update(`${c}:${topic.id}`).digest('hex').slice(0, 16),
  )

  return {
    id: randomUUID(),
    slug,
    title,
    introduction: sections[0]!.body,
    marketContext,
    technicalAnalysis,
    securityAnalysis,
    cryptocheckIntelligence,
    conclusion: sections[sections.length - 1]!.body,
    faq,
    sections,
    sources: [
      { label: topic.source, engine: topic.source },
      ...snapshot.citations.map((c) => ({ label: c, engine: c.split(':')[0] || c })),
      ...(topic.mint
        ? [{ label: 'Public token page', url: `/token/${topic.mint}`, engine: 'seo-token' }]
        : []),
    ],
    internalLinks,
    keywords: keyword
      ? [keyword.keyword, ...keyword.relatedKeywords.slice(0, 4)]
      : [symbol, 'solana scanner', 'CryptoCheckAI'],
    mint: topic.mint ?? null,
    topicId: topic.id,
    status: 'draft',
    quality: null,
    seo: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    engineCitations,
  }
}
