import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { rankKeywordOpportunities } from '../../lib/scout/modules/keyword-intel'
import { buildDailyContentPlan } from '../../lib/scout/modules/content-planner'
import { writeArticleFromEngines } from '../../lib/scout/modules/writer'
import { reviewArticleQuality } from '../../lib/scout/modules/quality-review'
import { buildDistributionBundle } from '../../lib/scout/modules/distributor'
import { buildArticleSeo } from '../../lib/scout/modules/seo-engine'
import { scoreTopicPriority, filterPublishableTopics } from '../../lib/scout/priority'
import { factCheckArticle } from '../../lib/scout/modules/fact-check'
import { applyLearningToTopics, derivePillarWeights } from '../../lib/scout/modules/learning'
import type { ScoutTopic } from '../../lib/scout/types'

const topic: ScoutTopic = {
  id: 'eco-terminal-test',
  title: 'Why traditional trading dashboards are becoming obsolete',
  narrative:
    'Terminal OS unifies Intelligence Chart, Security Scanner, and Secure Execution. Live trending signal for SOL from CryptoCheckAI market feeds.',
  source: 'ecosystem-pillar',
  mint: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  evidenceLine: 'Source=birdeye · change24h=1.2 · vol=1000000',
  discoveredAt: new Date().toISOString(),
  pillar: 'terminal_os',
  engineCited: true,
  priorityScore: 80,
}

describe('Scout V2 pipeline modules', () => {
  it('scores ecosystem topics above priority threshold', () => {
    const score = scoreTopicPriority(topic)
    assert.ok(score.passesThreshold, JSON.stringify(score))
    assert.ok(score.matchedPillars.includes('terminal_os'))
    const filtered = filterPublishableTopics([topic])
    assert.equal(filtered.length, 1)
  })

  it('ranks keywords without fabricating search volume', () => {
    const ops = rankKeywordOpportunities([topic])
    assert.ok(ops.length >= 1)
    assert.equal(ops[0]!.searchVolume, null)
    assert.equal(ops[0]!.method, 'heuristic')
    assert.ok(ops[0]!.semanticKeywords.length >= 1)
    assert.ok(ops[0]!.notes.toLowerCase().includes('unavailable'))
  })

  it('builds a ranked daily plan with blog + social targets', () => {
    const ops = rankKeywordOpportunities([topic])
    const plan = buildDailyContentPlan([topic], ops)
    assert.ok(plan.items.some((i) => i.kind === 'blog'))
    assert.ok(plan.items.some((i) => i.kind === 'tweet'))
    assert.ok(plan.items.some((i) => i.kind === 'reddit'))
    assert.ok(plan.items[0]!.expectedImpact >= plan.items[plan.items.length - 1]!.expectedImpact)
  })

  it('writes educate-first Terminal OS articles that pass quality review', () => {
    const ops = rankKeywordOpportunities([topic])
    const draft = writeArticleFromEngines({
      topic,
      keyword: ops[0],
      snapshot: {
        topics: [topic],
        marketBriefSummary: 'Market brief from buildMarketAnalystBrief.',
        marketBriefSources: ['Birdeye · Jupiter'],
        citations: ['market-feeds:trending:birdeye', 'portfolio-desk:market-analyst'],
        researchSources: ['coingecko', 'dexscreener:solana', 'market-feeds:birdeye'],
        gatheredAt: new Date().toISOString(),
      },
    })
    assert.ok(draft.engineCitations.length > 0)
    assert.ok(draft.internalLinks.some((l) => l.href === '/terminalOS'))
    assert.ok(draft.sections.length >= 6)
    assert.match(draft.sections.map((s) => s.heading).join(' '), /problem|tools fail|Terminal OS/i)
    assert.ok(draft.metaTitle.length > 10)
    assert.ok(draft.metaDescription.length >= 80)
    assert.match(draft.securityAnalysis, /does not invent|refuses to invent/i)

    const quality = reviewArticleQuality(draft)
    assert.equal(quality.passed, true, JSON.stringify(quality.checks.filter((c) => !c.passed)))

    const facts = factCheckArticle(draft, {
      topics: [topic],
      marketBriefSummary: 'Market brief from buildMarketAnalystBrief.',
      marketBriefSources: ['Birdeye · Jupiter'],
      citations: ['market-feeds:trending:birdeye'],
      researchSources: ['coingecko'],
      gatheredAt: new Date().toISOString(),
    })
    assert.equal(facts.passed, true, JSON.stringify(facts.findings.filter((f) => !f.passed)))

    const seo = buildArticleSeo({ ...draft, quality })
    assert.match(seo.canonicalPath, /^\/blog\//)
    assert.equal(seo.articleSchema['@type'], 'Article')
    assert.equal(seo.openGraph.type, 'article')
    assert.equal(seo.twitter.card, 'summary_large_image')

    const dist = buildDistributionBundle({ ...draft, quality, seo })
    assert.ok(dist.some((d) => d.channel === 'x_thread'))
    assert.ok(dist.some((d) => d.channel === 'linkedin'))
    assert.ok(dist.some((d) => d.channel === 'reddit'))
    assert.ok(dist.some((d) => d.channel === 'summary'))
    assert.notEqual(dist.find((d) => d.channel === 'x_thread')!.body, draft.introduction)
  })

  it('boosts pillars that previously auto-published', () => {
    const weights = derivePillarWeights([
      {
        id: '1',
        topicId: 't',
        signal: 'auto_published:terminal_os:slug:priority=80',
        weight: 2,
        createdAt: new Date().toISOString(),
      },
    ])
    assert.ok((weights.terminal_os ?? 0) > 0)
    const boosted = applyLearningToTopics([topic], [
      {
        id: '1',
        topicId: 't',
        signal: 'auto_published:terminal_os:slug',
        weight: 2,
        createdAt: new Date().toISOString(),
      },
    ])
    assert.ok((boosted[0]!.priorityScore ?? 0) >= (topic.priorityScore ?? 0))
  })
})
