import 'server-only'

import { randomUUID } from 'crypto'
import { SCOUT_AUTO_PUBLISH } from '@/lib/scout/constants'
import { PRIORITY_CONFIDENCE_THRESHOLD } from '@/lib/scout/strategy'
import { gatherScoutIntelligence } from '@/lib/scout/intelligence-bridge'
import { buildDailyContentPlan } from '@/lib/scout/modules/content-planner'
import { buildDistributionBundle } from '@/lib/scout/modules/distributor'
import { rankKeywordOpportunities } from '@/lib/scout/modules/keyword-intel'
import { reviewArticleQuality } from '@/lib/scout/modules/quality-review'
import { buildArticleSeo } from '@/lib/scout/modules/seo-engine'
import { notifySearchEnginesOfUrl } from '@/lib/scout/modules/search-notify'
import { writeArticleFromEngines } from '@/lib/scout/modules/writer'
import {
  appendLearningSignal,
  computeMetrics,
  emptyScoutState,
  enqueueArticle,
  listPublishedArticles,
  listQueuedArticles,
  loadScoutState,
  persistDistributions,
  saveScoutState,
  saveTodayPlan,
} from '@/lib/scout/store'
import type { ScoutArticleDraft, ScoutDashboardState } from '@/lib/scout/types'

export type ScoutRunOptions = {
  focusMint?: string | null
  maxArticles?: number
}

/**
 * Scout V2 cycle:
 * Research → priority filter → keywords → plan → write → SEO → quality →
 * auto-publish (default) → distributions → IndexNow/sitemap → learning.
 */
export async function runScoutCycle(opts: ScoutRunOptions = {}): Promise<ScoutDashboardState> {
  let state = await loadScoutState()
  state = {
    ...state,
    version: 'v2',
    autoPublish: SCOUT_AUTO_PUBLISH,
    priorityThreshold: PRIORITY_CONFIDENCE_THRESHOLD,
    status: 'researching',
    lastError: null,
  }

  try {
    const snapshot = await gatherScoutIntelligence({ focusMint: opts.focusMint })
    state.trendingTopics = snapshot.topics
    state.status = 'planning'

    const keywords = rankKeywordOpportunities(snapshot.topics)
    state.keywordOpportunities = keywords

    const plan = buildDailyContentPlan(snapshot.topics, keywords)
    state.todayPlan = plan
    await saveTodayPlan(plan)

    state.status = 'writing'
    const maxArticles = Math.min(opts.maxArticles ?? 2, 4)
    const blogItems = plan.items.filter((i) => i.kind === 'blog').slice(0, maxArticles)
    const drafted: ScoutArticleDraft[] = []
    const published = await listPublishedArticles(200)
    const existingSlugs = published.map((a) => a.slug)

    for (const item of blogItems) {
      const topic = snapshot.topics.find((t) => t.id === item.topicId)
      if (!topic) continue
      if ((topic.priorityScore ?? 0) < PRIORITY_CONFIDENCE_THRESHOLD) continue

      const keyword = keywords.find((k) => k.topicId === topic.id) ?? null
      let article = writeArticleFromEngines({ topic, keyword, snapshot })

      state.status = 'reviewing'
      const quality = reviewArticleQuality(article, { existingSlugs })
      article = {
        ...article,
        quality,
        status: quality.passed ? 'in_review' : 'draft',
        updatedAt: new Date().toISOString(),
      }
      article.seo = buildArticleSeo(article)

      if (!quality.passed) {
        await appendLearningSignal({
          id: randomUUID(),
          topicId: topic.id,
          articleId: article.id,
          signal: `quality_blocked:${quality.checks.filter((c) => !c.passed).map((c) => c.id).join(',')}`,
          weight: -1,
          createdAt: new Date().toISOString(),
        })
      } else {
        const distributions = buildDistributionBundle(article)
        await persistDistributions(distributions)
        state.distributions = [...distributions, ...state.distributions].slice(0, 120)

        if (SCOUT_AUTO_PUBLISH) {
          state.status = 'publishing'
          article = {
            ...article,
            status: 'published',
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            seo: buildArticleSeo({
              ...article,
              status: 'published',
              publishedAt: new Date().toISOString(),
            }),
          }
          existingSlugs.push(article.slug)
          // ~50ms estimated — best-effort IndexNow + sitemap ping
          void notifySearchEnginesOfUrl(`/blog/${article.slug}`)
          await appendLearningSignal({
            id: randomUUID(),
            topicId: topic.id,
            articleId: article.id,
            signal: `auto_published:${article.slug}:priority=${article.priorityScore}`,
            weight: 2,
            createdAt: new Date().toISOString(),
          })
        }
      }

      await enqueueArticle(article)
      drafted.push(article)
    }

    const queue = await listQueuedArticles()
    state.publicationQueue = queue.filter((a) => a.status !== 'published')
    state.recentArticles = [...drafted, ...queue].slice(0, 40)

    state.status = 'learning'
    await appendLearningSignal({
      id: randomUUID(),
      topicId: snapshot.topics[0]?.id ?? 'none',
      signal: `v2_cycle:topics=${snapshot.topics.length}:drafts=${drafted.length}:published=${drafted.filter((d) => d.status === 'published').length}:auto=${SCOUT_AUTO_PUBLISH}`,
      weight: 1,
      createdAt: new Date().toISOString(),
    })
    state.learning = [
      {
        id: randomUUID(),
        topicId: snapshot.topics[0]?.id ?? 'none',
        signal: `V2 priority≥${PRIORITY_CONFIDENCE_THRESHOLD}. Sources: ${snapshot.citations.join(', ') || 'none'}`,
        weight: 1,
        createdAt: new Date().toISOString(),
      },
      ...state.learning,
    ].slice(0, 50)

    state.metrics = await computeMetrics(state)
    state.status = 'idle'
    await saveScoutState(state)
    return state
  } catch (err) {
    const message = err instanceof Error ? err.message : 'scout_cycle_failed'
    console.error('[scout] runScoutCycle', err)
    state = {
      ...(state.trendingTopics ? state : emptyScoutState()),
      version: 'v2',
      autoPublish: SCOUT_AUTO_PUBLISH,
      priorityThreshold: PRIORITY_CONFIDENCE_THRESHOLD,
      status: 'error',
      lastError: message,
      updatedAt: new Date().toISOString(),
    }
    await saveScoutState(state)
    return state
  }
}

/** Optional manual gate when SCOUT_AUTO_PUBLISH=0. */
export async function approveScoutArticle(articleId: string): Promise<ScoutArticleDraft | null> {
  const queue = await listQueuedArticles()
  const article = queue.find((a) => a.id === articleId)
  if (!article) return null
  if (!article.quality?.passed) {
    throw new Error('Article failed quality review — cannot approve')
  }

  const published: ScoutArticleDraft = {
    ...article,
    status: 'published',
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    seo: article.seo ?? buildArticleSeo(article),
  }
  await enqueueArticle(published)

  void notifySearchEnginesOfUrl(`/blog/${published.slug}`)

  let state = await loadScoutState()
  state = {
    ...state,
    version: 'v2',
    autoPublish: SCOUT_AUTO_PUBLISH,
    priorityThreshold: PRIORITY_CONFIDENCE_THRESHOLD,
    status: 'publishing',
    recentArticles: [published, ...state.recentArticles.filter((a) => a.id !== published.id)].slice(
      0,
      40,
    ),
    publicationQueue: state.publicationQueue.filter((a) => a.id !== published.id),
  }
  state.metrics = await computeMetrics(state)
  state.status = 'idle'
  await saveScoutState(state)
  return published
}
