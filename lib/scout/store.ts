import 'server-only'

import { redis } from '@/lib/cache/redis'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  SCOUT_AUTO_PUBLISH,
  SCOUT_LEARNING_KEY,
  SCOUT_PLAN_KEY,
  SCOUT_QUEUE_KEY,
  SCOUT_STATE_KEY,
} from '@/lib/scout/constants'
import { PRIORITY_CONFIDENCE_THRESHOLD } from '@/lib/scout/strategy'
import type {
  DailyContentPlan,
  DistributionDraft,
  ScoutArticleDraft,
  ScoutDashboardState,
  ScoutLearningSignal,
  ScoutMetricsSnapshot,
} from '@/lib/scout/types'

function emptyMetrics(): ScoutMetricsSnapshot {
  return {
    articlesPublished: 0,
    articlesIndexed: null,
    rankingKeywords: null,
    organicUsers: null,
    trafficGrowthPct: null,
    googleImpressions: null,
    googleClicks: null,
    googleCtr: null,
    avgPosition: null,
    accountsCreated: null,
    walletConnections: null,
    terminalOsSessions: null,
    revenueInfluenced: null,
    queueDepth: 0,
    avgQualityScore: null,
    avgPriorityScore: null,
    generatedAt: new Date().toISOString(),
    sample: true,
  }
}

export function emptyScoutState(): ScoutDashboardState {
  return {
    status: 'idle',
    version: 'v2',
    autoPublish: SCOUT_AUTO_PUBLISH,
    priorityThreshold: PRIORITY_CONFIDENCE_THRESHOLD,
    trendingTopics: [],
    keywordOpportunities: [],
    todayPlan: null,
    recentArticles: [],
    publicationQueue: [],
    distributions: [],
    metrics: emptyMetrics(),
    learning: [],
    lastError: null,
    updatedAt: new Date().toISOString(),
  }
}

export async function loadScoutState(): Promise<ScoutDashboardState> {
  try {
    const raw = await redis.get(SCOUT_STATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ScoutDashboardState
      if (parsed && typeof parsed === 'object') {
        const base = emptyScoutState()
        return {
          ...base,
          ...parsed,
          version: 'v2',
          autoPublish: SCOUT_AUTO_PUBLISH,
          priorityThreshold: PRIORITY_CONFIDENCE_THRESHOLD,
          metrics: { ...base.metrics, ...parsed.metrics },
        }
      }
    }
  } catch {
    /* fall through */
  }
  return emptyScoutState()
}

export async function saveScoutState(state: ScoutDashboardState): Promise<void> {
  const next = { ...state, updatedAt: new Date().toISOString() }
  try {
    await redis.setex(SCOUT_STATE_KEY, 60 * 60 * 24, JSON.stringify(next))
  } catch (err) {
    console.error('[scout] saveScoutState redis', err)
  }

  // Best-effort durable mirror
  try {
    const sb = getSupabaseAdmin()
    await sb.from('scout_dashboard_snapshots').insert({
      status: next.status,
      payload: next,
      created_at: next.updatedAt,
    })
  } catch {
    /* table may not exist yet in some envs */
  }
}

export async function saveTodayPlan(plan: DailyContentPlan): Promise<void> {
  try {
    await redis.setex(SCOUT_PLAN_KEY, 60 * 60 * 36, JSON.stringify(plan))
  } catch (err) {
    console.error('[scout] saveTodayPlan', err)
  }
}

export async function enqueueArticle(article: ScoutArticleDraft): Promise<void> {
  try {
    const raw = await redis.get(SCOUT_QUEUE_KEY)
    const queue: ScoutArticleDraft[] = raw ? (JSON.parse(raw) as ScoutArticleDraft[]) : []
    const next = [article, ...queue.filter((a) => a.id !== article.id)].slice(0, 100)
    await redis.setex(SCOUT_QUEUE_KEY, 60 * 60 * 24 * 7, JSON.stringify(next))
  } catch (err) {
    console.error('[scout] enqueueArticle', err)
  }

  try {
    const sb = getSupabaseAdmin()
    await sb.from('scout_articles').upsert(
      {
        id: article.id,
        slug: article.slug,
        title: article.title,
        topic_id: article.topicId,
        mint: article.mint,
        status: article.status,
        body: article,
        quality_score: article.quality?.score ?? null,
        published_at: article.publishedAt,
        updated_at: article.updatedAt,
        created_at: article.createdAt,
      },
      { onConflict: 'id' },
    )
  } catch (err) {
    console.error('[scout] enqueueArticle supabase', err)
  }
}

export async function listQueuedArticles(): Promise<ScoutArticleDraft[]> {
  try {
    const raw = await redis.get(SCOUT_QUEUE_KEY)
    if (raw) return JSON.parse(raw) as ScoutArticleDraft[]
  } catch {
    /* fall through */
  }
  try {
    const sb = getSupabaseAdmin()
    const { data } = await sb
      .from('scout_articles')
      .select('body')
      .in('status', ['draft', 'in_review', 'approved'])
      .order('updated_at', { ascending: false })
      .limit(50)
    return (data ?? []).map((r) => r.body as ScoutArticleDraft).filter(Boolean)
  } catch {
    return []
  }
}

export async function getPublishedArticleBySlug(slug: string): Promise<ScoutArticleDraft | null> {
  try {
    const sb = getSupabaseAdmin()
    const { data } = await sb
      .from('scout_articles')
      .select('body')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
    if (data?.body) return data.body as ScoutArticleDraft
  } catch {
    /* fall through */
  }
  const queue = await listQueuedArticles()
  return queue.find((a) => a.slug === slug && a.status === 'published') ?? null
}

export async function listPublishedArticles(limit = 30): Promise<ScoutArticleDraft[]> {
  try {
    const sb = getSupabaseAdmin()
    const { data } = await sb
      .from('scout_articles')
      .select('body')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit)
    if (data?.length) return data.map((r) => r.body as ScoutArticleDraft)
  } catch {
    /* fall through */
  }
  const queue = await listQueuedArticles()
  return queue.filter((a) => a.status === 'published').slice(0, limit)
}

export async function persistDistributions(rows: DistributionDraft[]): Promise<void> {
  try {
    const sb = getSupabaseAdmin()
    for (const row of rows) {
      await sb.from('scout_distributions').upsert(
        {
          id: row.id,
          article_id: row.articleId,
          channel: row.channel,
          title: row.title,
          body: row.body,
          status: row.status,
          adapted_at: row.adaptedAt,
        },
        { onConflict: 'id' },
      )
    }
  } catch (err) {
    console.error('[scout] persistDistributions', err)
  }
}

export async function appendLearningSignal(signal: ScoutLearningSignal): Promise<void> {
  try {
    const raw = await redis.get(SCOUT_LEARNING_KEY)
    const prev: ScoutLearningSignal[] = raw ? (JSON.parse(raw) as ScoutLearningSignal[]) : []
    const next = [signal, ...prev].slice(0, 200)
    await redis.setex(SCOUT_LEARNING_KEY, 60 * 60 * 24 * 30, JSON.stringify(next))
  } catch (err) {
    console.error('[scout] appendLearningSignal', err)
  }
}

export async function computeMetrics(state: ScoutDashboardState): Promise<ScoutMetricsSnapshot> {
  const published = state.recentArticles.filter((a) => a.status === 'published')
  const scores = state.recentArticles
    .map((a) => a.quality?.score)
    .filter((n): n is number => typeof n === 'number')
  const priorities = state.recentArticles
    .map((a) => a.priorityScore)
    .filter((n): n is number => typeof n === 'number')
  return {
    articlesPublished: published.length,
    articlesIndexed: null,
    rankingKeywords: null,
    organicUsers: null,
    trafficGrowthPct: null,
    googleImpressions: null,
    googleClicks: null,
    googleCtr: null,
    avgPosition: null,
    accountsCreated: null,
    walletConnections: null,
    terminalOsSessions: null,
    revenueInfluenced: null,
    queueDepth: state.publicationQueue.filter((a) => a.status !== 'published').length,
    avgQualityScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
    avgPriorityScore: priorities.length
      ? Math.round(priorities.reduce((a, b) => a + b, 0) / priorities.length)
      : null,
    generatedAt: new Date().toISOString(),
    sample: true,
  }
}
