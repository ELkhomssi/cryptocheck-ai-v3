import { randomUUID } from 'crypto'
import type {
  ContentPlanItem,
  DailyContentPlan,
  KeywordOpportunity,
  ScoutTopic,
} from '@/lib/scout/types'

/**
 * Build today's ranked execution plan from priority-filtered topics + keyword scores.
 * V2: blog-first, then multi-channel derivatives after quality/auto-publish.
 */
export function buildDailyContentPlan(
  topics: ScoutTopic[],
  keywords: KeywordOpportunity[],
): DailyContentPlan {
  const byTopic = new Map(keywords.map((k) => [k.topicId, k]))
  const ranked = [...topics].sort((a, b) => {
    const pa = a.priorityScore ?? byTopic.get(a.id)?.opportunityScore ?? 0
    const pb = b.priorityScore ?? byTopic.get(b.id)?.opportunityScore ?? 0
    if (pb !== pa) return pb - pa
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
      expectedImpact: t.priorityScore ?? kw?.opportunityScore ?? 40,
      status: 'queued',
      rationale: `${t.pillar ?? 'ecosystem'} · ${kw?.notes ?? t.evidenceLine}`,
    })
  }

  for (const t of blogTopics.slice(0, 4)) {
    items.push({
      id: randomUUID(),
      kind: 'tweet',
      topicId: t.id,
      title: `X thread: ${t.title}`,
      expectedImpact: (t.priorityScore ?? 40) * 0.55,
      status: 'queued',
      rationale: 'Platform-adapted thread from published blog draft',
    })
  }
  for (const t of blogTopics.slice(0, 2)) {
    items.push({
      id: randomUUID(),
      kind: 'linkedin',
      topicId: t.id,
      title: `LinkedIn: ${t.title}`,
      expectedImpact: (t.priorityScore ?? 40) * 0.5,
      status: 'queued',
      rationale: 'Institutional LinkedIn adaptation',
    })
    items.push({
      id: randomUUID(),
      kind: 'reddit',
      topicId: t.id,
      title: `Reddit: ${t.title}`,
      expectedImpact: (t.priorityScore ?? 40) * 0.45,
      status: 'queued',
      rationale: 'Educational Reddit version — no hype',
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
      rationale: 'Digest candidate from top priority topic',
    })
    items.push({
      id: randomUUID(),
      kind: 'discord',
      topicId: ranked[0].id,
      title: `Discord: ${ranked[0].title}`,
      expectedImpact: 55,
      status: 'queued',
      rationale: 'Discord announcement derived from article',
    })
    items.push({
      id: randomUUID(),
      kind: 'telegram',
      topicId: ranked[0].id,
      title: `Telegram: ${ranked[0].title}`,
      expectedImpact: 55,
      status: 'queued',
      rationale: 'Telegram announcement derived from article',
    })
  }
  for (const t of ranked
    .filter((x) => x.source === 'scan-gateway' || x.source === 'market-analyst' || x.source === 'ecosystem-pillar')
    .slice(0, 2)) {
    items.push({
      id: randomUUID(),
      kind: 'research_report',
      topicId: t.id,
      title: `Research: ${t.title}`,
      expectedImpact: 75,
      status: 'queued',
      rationale: 'Long-form research from engine citations + ecosystem pillar',
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
