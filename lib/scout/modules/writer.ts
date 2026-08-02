import { createHash, randomUUID } from 'crypto'
import { SCOUT_DISCLAIMER, SCOUT_INTERNAL_LINKS } from '@/lib/scout/constants'
import { getPillar, type EcosystemPillar } from '@/lib/scout/strategy'
import type { KeywordOpportunity, ScoutArticleDraft, ScoutTopic } from '@/lib/scout/types'
import type { ScoutEngineSnapshot } from '@/lib/scout/intelligence-bridge'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function readingMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(3, Math.min(18, Math.round(words / 220)))
}

function resolvePillar(topic: ScoutTopic): EcosystemPillar {
  return topic.pillar ?? 'terminal_os'
}

/**
 * Professional Writer V2 — educate first, Terminal OS as central character.
 * Structure: problem → tool failure → professional approach → CCAI → Terminal OS → visual → CTA.
 * Does not invent prices, verdicts, or whale stats.
 */
export function writeArticleFromEngines(input: {
  topic: ScoutTopic
  keyword?: KeywordOpportunity | null
  snapshot: ScoutEngineSnapshot
}): ScoutArticleDraft {
  const { topic, keyword, snapshot } = input
  const now = new Date().toISOString()
  const pillarId = resolvePillar(topic)
  const pillar = getPillar(pillarId)
  const symbol = topic.symbol || null
  const seedTitle = pillar.seedTitles[0] ?? pillar.label

  const title = symbol
    ? `${seedTitle}: ${symbol} context inside Terminal OS`
    : seedTitle.length > 72
      ? seedTitle.slice(0, 72)
      : seedTitle

  const slugBase = slugify(
    `${pillar.id}-${symbol ?? 'ecosystem'}-${topic.id.slice(-6)}`,
  )
  const slug = slugBase || `scout-${randomUUID().slice(0, 8)}`

  const liveEvidence = topic.evidenceLine
  const marketLine =
    snapshot.marketBriefSummary ||
    `Live feed evidence for this cycle: ${liveEvidence}. When Market Analyst is unavailable, Scout does not invent a macro narrative.`

  const problem = [
    pillar.problem,
    symbol
      ? `Today’s desks are also watching ${symbol} — evidence: ${liveEvidence}.`
      : `Current cycle evidence: ${liveEvidence}.`,
  ].join(' ')

  const toolsFail = [
    pillar.toolFailure,
    'Most crypto blogs and dashboards optimize for attention, not decision quality. They sell urgency without an operating system for risk.',
  ].join(' ')

  const prosSolve = [
    pillar.professionalApproach,
    'Professionals treat intelligence as a workflow: structure → risk → decision → execution — with an audit trail.',
  ].join(' ')

  const ccaiSolves = [
    pillar.ccaiSolution,
    `Citations for this draft: ${snapshot.citations.join(', ') || 'engine cycle'}.`,
    snapshot.marketBriefSources.length
      ? `Market analyst note: ${snapshot.marketBriefSources.join(' · ')}.`
      : 'Market analyst note: unavailable for this cycle — Scout stays silent rather than invent.',
    'CryptoCheckAI remains the single source of truth for risk, market, and wallet intelligence. Scout does not invent analysis.',
  ].join(' ')

  const terminalOsExamples = [
    'Terminal OS is the desk where these surfaces share context:',
    '• Intelligence Chart — market structure without indicator theater.',
    '• Security Scanner — risk before impulse, via the scan gateway.',
    '• AI Gateway — one intelligence contract for scanners and builders.',
    '• AI Coaching — process feedback that refuses to invent edge.',
    '• Trade Like Me — decision patterns, still risk-gated before any execution path.',
    '• Portfolio Intelligence & Capital Rotation — exposure narrative, not fabricated PnL.',
    '• Secure Execution — simulate before send; non-custodial; fees explicit.',
    '• Discovery Engine — candidates routed into diligence, never auto-armed snipers.',
    symbol && topic.mint
      ? `For ${symbol}, open /token/${topic.mint} and /scanner with the mint attached — live state, not a blog quote.`
      : 'Open /terminalOS to see the same engines Scout cites.',
  ]
    .filter(Boolean)
    .join('\n')

  const screenshots = [
    'Visual assets (when available): Terminal OS desk screenshot, Intelligence Chart structure view, Security Scanner verdict rail.',
    'Image generation prompt for design ops:',
    `"Ultra-dark CryptoCheckAI Terminal OS desk, glass panels, gold accent #c8ff00, ${pillar.label} focus, no hype text, institutional trading OS aesthetic."`,
  ].join('\n')

  const cta = [
    'Continue in product — not another tab of noise:',
    '1. Open Terminal OS and load the desk that matches this article’s pillar.',
    '2. Run Security Scanner before any size decision.',
    '3. Use AI Coaching / Trade Like Me only as process aids — never as profit promises.',
    SCOUT_DISCLAIMER,
  ].join('\n')

  const securityAnalysis =
    topic.source === 'scan-gateway'
      ? `Security analysis cites the scan gateway assessment only. ${topic.narrative} Evidence: ${liveEvidence}. DANGER language follows gateway verdicts — never upgraded for engagement. Scout refuses to invent honeypot / authority findings.`
      : `No dedicated scan-gateway run is attached unless a mint was focused this cycle. Security claims stay general: use Terminal OS Scanner before capital moves. Scout refuses to invent honeypot / authority findings. Evidence context: ${liveEvidence}.`

  const technicalAnalysis = topic.mint
    ? `Listing / feed context for mint \`${topic.mint}\` is grounded in CryptoCheckAI market feeds (${topic.source}). Evidence: ${liveEvidence}. Chart surfaces remain in Terminal OS Intelligence Chart — Scout does not fabricate OHLC.`
    : `Technical claims are restricted to aggregate feed evidence and ecosystem education: ${liveEvidence}. Scout does not invent candles or volume series.`

  const faq = [
    {
      question: 'What is Terminal OS?',
      answer:
        'Terminal OS is CryptoCheckAI’s AI operating system for trading desks — unifying Intelligence Chart, Security Scanner, AI Coaching, Trade Like Me, Portfolio Intelligence, Discovery, and Secure Execution under one decision workflow.',
    },
    {
      question: `Why does this article focus on ${pillar.label}?`,
      answer: `${pillar.ccaiSolution} Live cycle evidence: ${liveEvidence}.`,
    },
    {
      question: 'Is this financial advice?',
      answer: SCOUT_DISCLAIMER,
    },
    {
      question: 'Where do I go next?',
      answer: topic.mint
        ? `Open Terminal OS, then /token/${topic.mint} and the Security Scanner for mint ${topic.mint}.`
        : 'Open /terminalOS — then AI Gateway docs, Scanner, or Coaching depending on your next decision.',
    },
  ]

  const internalLinks = [
    ...SCOUT_INTERNAL_LINKS.map((l) => ({ href: l.href, anchor: l.anchor })),
    ...pillar.productPaths.map((href) => ({
      href,
      anchor: SCOUT_INTERNAL_LINKS.find((l) => l.href === href)?.anchor ?? href,
    })),
    ...(topic.mint
      ? [
          { href: `/token/${topic.mint}`, anchor: `${symbol ?? 'Token'} page` },
          { href: `/scanner?mint=${encodeURIComponent(topic.mint)}`, anchor: `Scan ${symbol ?? 'mint'}` },
        ]
      : []),
  ]
  // Dedupe by href
  const seen = new Set<string>()
  const dedupedLinks = internalLinks.filter((l) => {
    if (seen.has(l.href)) return false
    seen.add(l.href)
    return true
  })

  const sections = [
    { id: 'problem', heading: 'The real problem traders face', body: problem },
    { id: 'tools-fail', heading: 'Why current tools fail', body: toolsFail },
    { id: 'professionals', heading: 'How professionals solve it', body: prosSolve },
    { id: 'cryptocheck', heading: 'How CryptoCheckAI solves it', body: ccaiSolves },
    { id: 'terminal-os', heading: 'Terminal OS in practice', body: terminalOsExamples },
    { id: 'visuals', heading: 'Visual intelligence', body: screenshots },
    { id: 'cta', heading: 'Next step', body: cta },
    { id: 'market', heading: 'Market context (engine snapshot)', body: marketLine },
    { id: 'security', heading: 'Security stance', body: securityAnalysis },
  ]

  const fullText = sections.map((s) => s.body).join('\n')
  const metaDescription = `${pillar.label}: ${problem}`.replace(/\s+/g, ' ').trim().slice(0, 155)
  const metaTitle = `${title} | CryptoCheckAI`.slice(0, 70)

  const keywords = keyword
    ? [keyword.keyword, pillar.label, 'Terminal OS', ...keyword.relatedKeywords.slice(0, 4)]
    : [pillar.label, 'Terminal OS', 'CryptoCheckAI', 'AI Gateway', 'Security Scanner']

  const longTailKeywords = keyword?.longTail ?? [
    `what is cryptocheckai terminal os`,
    `how ${pillar.label.toLowerCase()} works in terminal os`,
    `ai gateway vs traditional crypto apis`,
  ]

  const semanticKeywords = keyword?.semanticKeywords ?? [
    'decision intelligence',
    'on-chain intelligence',
    'portfolio automation',
    'secure execution',
  ]

  const engineCitations = snapshot.citations.map(
    (c) => createHash('sha256').update(`${c}:${topic.id}`).digest('hex').slice(0, 16),
  )
  if (engineCitations.length === 0) {
    engineCitations.push(
      createHash('sha256').update(`ecosystem:${pillar.id}:${snapshot.gatheredAt}`).digest('hex').slice(0, 16),
    )
  }

  const priorityScore = topic.priorityScore ?? 70
  const aiConfidence = Math.min(96, Math.max(55, priorityScore + (snapshot.citations.length > 0 ? 8 : 0)))

  const imagePrompt = `Ultra-dark CryptoCheckAI Terminal OS, glass UI, gold accent, ${pillar.label}, institutional, no hype typography`

  return {
    id: randomUUID(),
    slug,
    title,
    metaTitle,
    metaDescription,
    introduction: problem,
    marketContext: marketLine,
    technicalAnalysis,
    securityAnalysis,
    cryptocheckIntelligence: ccaiSolves,
    conclusion: cta,
    faq,
    sections,
    sources: [
      { label: topic.source, engine: topic.source },
      { label: pillar.label, engine: `pillar:${pillar.id}` },
      ...snapshot.citations.map((c) => ({ label: c, engine: c.split(':')[0] || c })),
      ...(topic.mint
        ? [{ label: 'Public token page', url: `/token/${topic.mint}`, engine: 'seo-token' }]
        : []),
    ],
    internalLinks: dedupedLinks,
    keywords,
    longTailKeywords,
    semanticKeywords,
    mint: topic.mint ?? null,
    topicId: topic.id,
    pillar: pillarId,
    category: pillar.label,
    readingMinutes: readingMinutes(fullText),
    aiConfidence,
    imagePrompt,
    priorityScore,
    status: 'draft',
    quality: null,
    seo: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    engineCitations,
  }
}
