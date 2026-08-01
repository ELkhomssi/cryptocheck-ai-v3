import { randomUUID } from 'crypto'
import type {
  ContentPlanItem,
  DailyContentPlan,
  KeywordOpportunity,
  ScoutTopic,
} from '@/lib/scout/types'

/**
 * Build today's ranked execution plan from live topics + keyword scores.
 * Counts are targets — actual writes still require quality review + approval.
 */
export function buildDailyContentPlan(
  topics: ScoutTopic[],
  keywords: KeywordOpportunity[],
): DailyContentPlan {
  const byTopic = new Map(keywords.map((k) => [k.topicId, k]))
  const ranked = [...topics].sort((a, b) => {
    const ka = byTopic.get(a.id)?.opportunityScore ?? 0
    const kb = byTopic.get(b.id)?.opportunityScore ?? 0
    return kb - ka
  })

  const items: ContentPlanItem[] = []
  const blogTopics = ranked.slice(0, 5)
  for (const t of blogTopics) {
    const kw = byTopic.get(t.id)
    items.push({
      id: randomUUID(),
      kind: 'blog',
      topicId: t.id,
      title: t.title,
      expectedImpact: kw?.opportunityScore ?? 40,
      status: 'queued',
      rationale: kw?.notes ?? t.evidenceLine,
    })
  }

  // Distribution targets derived from top blog topics (rewrites happen later)
  for (const t of blogTopics.slice(0, 4)) {
    items.push({
      id: randomUUID(),
      kind: 'tweet',
      topicId: t.id,
      title: `X thread: ${t.title}`,
      expectedImpact: (byTopic.get(t.id)?.opportunityScore ?? 40) * 0.55,
      status: 'queued',
      rationale: 'Platform-adapted thread from approved blog draft',
    })
  }
  for (const t of blogTopics.slice(0, 2)) {
    items.push({
      id: randomUUID(),
      kind: 'linkedin',
      topicId: t.id,
      title: `LinkedIn: ${t.title}`,
      expectedImpact: (byTopic.get(t.id)?.opportunityScore ?? 40) * 0.5,
      status: 'queued',
      rationale: 'Institutional LinkedIn adaptation',
    })
  }
  if (ranked[0]) {
    items.push({
      id: randomUUID(),
      kind: 'newsletter',
      topicId: ranked[0].id,
      title: `Newsletter: ${ranked[0].title}`,
      expectedImpact: 70,
      status: 'queued',
      rationale: 'Weekly digest candidate from top opportunity',
    })
  }
  for (const t of ranked.filter((x) => x.source === 'scan-gateway' || x.source === 'market-analyst').slice(0, 2)) {
    items.push({
      id: randomUUID(),
      kind: 'research_report',
      topicId: t.id,
      title: `Research: ${t.title}`,
      expectedImpact: 75,
      status: 'queued',
      rationale: 'Long-form research from engine citations only',
    })
  }

  items.sort((a, b) => b.expectedImpact - a.expectedImpact)

  return {
    id: randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    items,
    generatedAt: new Date().toISOString(),
    sources: [...new Set(topics.map((t) => t.source))],
  }
}
