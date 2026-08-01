/**
 * Scout — Growth Intelligence Operating System contracts.
 * Scout never invents market analysis; it transforms CryptoCheckAI engine outputs.
 */

export type ScoutStatus =
  | 'idle'
  | 'researching'
  | 'planning'
  | 'writing'
  | 'reviewing'
  | 'publishing'
  | 'learning'
  | 'error'

export type ScoutTopicSource =
  | 'birdeye-trending'
  | 'dexscreener-trending'
  | 'new-launches'
  | 'scan-gateway'
  | 'market-analyst'
  | 'whale-feed'
  | 'manual'

export type SearchIntent = 'informational' | 'navigational' | 'commercial' | 'transactional'

export type ScoutTopic = {
  id: string
  title: string
  narrative: string
  source: ScoutTopicSource
  mint?: string | null
  symbol?: string | null
  evidenceLine: string
  discoveredAt: string
  /** True only when synthetic demo rows are intentionally shown in UI. */
  sample?: boolean
}

export type KeywordOpportunity = {
  keyword: string
  topicId: string
  /** null when no paid SEO API is configured — never fabricate volume */
  searchVolume: number | null
  /** 0–100 heuristic difficulty; method disclosed */
  keywordDifficulty: number | null
  intent: SearchIntent
  relatedKeywords: string[]
  longTail: string[]
  peopleAlsoAsk: string[]
  opportunityScore: number
  method: 'heuristic' | 'provider'
  notes: string
}

export type ContentPlanItem = {
  id: string
  kind: 'blog' | 'tweet' | 'linkedin' | 'newsletter' | 'research_report'
  topicId: string
  title: string
  expectedImpact: number
  status: 'queued' | 'in_progress' | 'draft_ready' | 'blocked'
  rationale: string
}

export type DailyContentPlan = {
  id: string
  date: string
  items: ContentPlanItem[]
  generatedAt: string
  sources: string[]
}

export type ArticleSection = {
  heading: string
  body: string
}

export type ScoutArticleDraft = {
  id: string
  slug: string
  title: string
  introduction: string
  marketContext: string
  technicalAnalysis: string
  securityAnalysis: string
  cryptocheckIntelligence: string
  conclusion: string
  faq: Array<{ question: string; answer: string }>
  sections: ArticleSection[]
  sources: Array<{ label: string; url?: string; engine: string }>
  internalLinks: Array<{ href: string; anchor: string }>
  keywords: string[]
  mint?: string | null
  topicId: string
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'rejected'
  quality: QualityReport | null
  seo: ScoutSeoPayload | null
  createdAt: string
  updatedAt: string
  publishedAt?: string | null
  /** Engine snapshot hashes — audit trail, not invented narrative */
  engineCitations: string[]
}

export type QualityCheckId =
  | 'grammar'
  | 'seo'
  | 'readability'
  | 'duplicate'
  | 'eeat'
  | 'technical_accuracy'
  | 'factual_consistency'
  | 'internal_links'
  | 'external_sources'
  | 'no_hallucination'

export type QualityReport = {
  passed: boolean
  score: number
  checks: Array<{ id: QualityCheckId; passed: boolean; detail: string }>
  reviewedAt: string
}

export type ScoutSeoPayload = {
  title: string
  description: string
  canonicalPath: string
  jsonLd: Record<string, unknown>[]
  faqSchema: Record<string, unknown>
  breadcrumbSchema: Record<string, unknown>
  articleSchema: Record<string, unknown>
}

export type DistributionChannel =
  | 'blog'
  | 'x_thread'
  | 'linkedin'
  | 'telegram'
  | 'discord'
  | 'newsletter'
  | 'medium'
  | 'devto'
  | 'hashnode'

export type DistributionDraft = {
  id: string
  articleId: string
  channel: DistributionChannel
  title: string
  body: string
  status: 'draft' | 'approved' | 'published' | 'rejected'
  adaptedAt: string
}

export type ScoutMetricsSnapshot = {
  articlesPublished: number
  articlesIndexed: number | null
  rankingKeywords: number | null
  organicUsers: number | null
  trafficGrowthPct: number | null
  queueDepth: number
  avgQualityScore: number | null
  generatedAt: string
  /** Metrics are null until Search Console / analytics are wired */
  sample: boolean
}

export type ScoutLearningSignal = {
  id: string
  topicId: string
  articleId?: string
  signal: string
  weight: number
  createdAt: string
}

export type ScoutDashboardState = {
  status: ScoutStatus
  trendingTopics: ScoutTopic[]
  keywordOpportunities: KeywordOpportunity[]
  todayPlan: DailyContentPlan | null
  recentArticles: ScoutArticleDraft[]
  publicationQueue: ScoutArticleDraft[]
  distributions: DistributionDraft[]
  metrics: ScoutMetricsSnapshot
  learning: ScoutLearningSignal[]
  lastError: string | null
  updatedAt: string
}
