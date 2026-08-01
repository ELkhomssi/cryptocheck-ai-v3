import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { rankKeywordOpportunities } from '../../lib/scout/modules/keyword-intel'
import { buildDailyContentPlan } from '../../lib/scout/modules/content-planner'
import { writeArticleFromEngines } from '../../lib/scout/modules/writer'
import { reviewArticleQuality } from '../../lib/scout/modules/quality-review'
import { buildDistributionBundle } from '../../lib/scout/modules/distributor'
import { buildArticleSeo } from '../../lib/scout/modules/seo-engine'
import type { ScoutTopic } from '../../lib/scout/types'

const topic: ScoutTopic = {
  id: 'trend-SOL-test',
  title: 'SOL trending on Solana',
  narrative: 'Live trending signal for SOL from CryptoCheckAI market feeds.',
  source: 'birdeye-trending',
  mint: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  evidenceLine: 'Source=birdeye · change24h=1.2 · vol=1000000',
  discoveredAt: new Date().toISOString(),
}

describe('Scout pipeline modules', () => {
  it('ranks keywords without fabricating search volume', () => {
    const ops = rankKeywordOpportunities([topic])
    assert.ok(ops.length >= 1)
    assert.equal(ops[0]!.searchVolume, null)
    assert.equal(ops[0]!.method, 'heuristic')
    assert.ok(ops[0]!.notes.toLowerCase().includes('unavailable'))
  })

  it('builds a ranked daily plan with blog + social targets', () => {
    const ops = rankKeywordOpportunities([topic])
    const plan = buildDailyContentPlan([topic], ops)
    assert.ok(plan.items.some((i) => i.kind === 'blog'))
    assert.ok(plan.items.some((i) => i.kind === 'tweet'))
    assert.ok(plan.items[0]!.expectedImpact >= plan.items[plan.items.length - 1]!.expectedImpact)
  })

  it('writes engine-cited articles that pass quality review', () => {
    const ops = rankKeywordOpportunities([topic])
    const draft = writeArticleFromEngines({
      topic,
      keyword: ops[0],
      snapshot: {
        topics: [topic],
        marketBriefSummary: 'Market brief from buildMarketAnalystBrief.',
        marketBriefSources: ['Birdeye · Jupiter'],
        citations: ['market-feeds:trending:birdeye', 'portfolio-desk:market-analyst'],
        gatheredAt: new Date().toISOString(),
      },
    })
    assert.ok(draft.engineCitations.length > 0)
    assert.ok(draft.internalLinks.length >= 3)
    assert.match(draft.securityAnalysis, /does not invent|refuses to invent|No dedicated scan-gateway/i)

    const quality = reviewArticleQuality(draft)
    assert.equal(quality.passed, true, JSON.stringify(quality.checks.filter((c) => !c.passed)))

    const seo = buildArticleSeo({ ...draft, quality })
    assert.match(seo.canonicalPath, /^\/blog\//)
    assert.equal(seo.articleSchema['@type'], 'Article')

    const dist = buildDistributionBundle({ ...draft, quality, seo })
    assert.ok(dist.some((d) => d.channel === 'x_thread'))
    assert.ok(dist.some((d) => d.channel === 'linkedin'))
    assert.notEqual(dist.find((d) => d.channel === 'x_thread')!.body, draft.introduction)
  })
})
