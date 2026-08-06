import { randomUUID } from 'crypto'
import { SCOUT_DISCLAIMER } from '@/lib/scout/constants'
import type { DistributionChannel, DistributionDraft, ScoutArticleDraft } from '@/lib/scout/types'

function rewriteForChannel(
  article: ScoutArticleDraft,
  channel: DistributionChannel,
): { title: string; body: string } {
  const pillar = article.category || 'Terminal OS'
  switch (channel) {
    case 'x_thread':
      return {
        title: `Thread: ${article.title}`.slice(0, 80),
        body: [
          `1/ ${article.title}`,
          `2/ Problem: ${article.introduction.slice(0, 220)}`,
          `3/ Why dashboards fail: most tools show data — Terminal OS orchestrates judgment.`,
          `4/ ${pillar} inside CryptoCheckAI — evidence-bound, not hype.`,
          `5/ Open Terminal OS → https://www.cryptocheckai.com/terminalOS`,
          `6/ Full brief → https://www.cryptocheckai.com/blog/${article.slug}`,
          `7/ ${SCOUT_DISCLAIMER}`,
        ].join('\n\n'),
      }
    case 'linkedin':
      return {
        title: article.title,
        body: [
          article.introduction,
          '',
          'Institutional takeaway:',
          `• ${article.cryptocheckIntelligence.slice(0, 220)}`,
          '• Terminal OS unifies Intelligence Chart, Security Scanner, AI Coaching, and Secure Execution.',
          '',
          `Read: https://www.cryptocheckai.com/blog/${article.slug}`,
          '',
          SCOUT_DISCLAIMER,
        ].join('\n'),
      }
    case 'telegram':
      return {
        title: `Scout · ${pillar}`,
        body: `*${article.title}*\n\n${article.introduction.slice(0, 360)}\n\nTerminal OS → /terminalOS\nArticle → /blog/${article.slug}\n${SCOUT_DISCLAIMER}`,
      }
    case 'discord':
      return {
        title: article.title,
        body: `**${article.title}**\n${article.introduction.slice(0, 320)}\n→ https://www.cryptocheckai.com/blog/${article.slug}\n→ https://www.cryptocheckai.com/terminalOS`,
      }
    case 'newsletter':
      return {
        title: `CryptoCheckAI Scout — ${article.title}`,
        body: [
          article.introduction,
          article.cryptocheckIntelligence,
          article.conclusion,
          `Open Terminal OS: https://www.cryptocheckai.com/terminalOS`,
          SCOUT_DISCLAIMER,
        ].join('\n\n'),
      }
    case 'reddit':
      return {
        title: article.title.slice(0, 280),
        body: [
          article.introduction,
          '',
          '### Why this is not another crypto blog post',
          'CryptoCheckAI Scout only publishes when live engines + ecosystem priority clear a confidence threshold. No profit promises.',
          '',
          '### Terminal OS angle',
          article.sections.find((s) => s.id === 'terminal-os')?.body.slice(0, 500) ||
            article.cryptocheckIntelligence.slice(0, 500),
          '',
          `Full article: https://www.cryptocheckai.com/blog/${article.slug}`,
          '',
          SCOUT_DISCLAIMER,
        ].join('\n'),
      }
    case 'summary':
      return {
        title: `Summary: ${article.title}`.slice(0, 100),
        body: [
          `${article.category} · AI confidence ${article.aiConfidence}% · ~${article.readingMinutes} min`,
          article.metaDescription,
          `CTA: Terminal OS → /terminalOS · Article → /blog/${article.slug}`,
        ].join('\n'),
      }
    case 'medium':
    case 'devto':
    case 'hashnode':
      return {
        title: article.title,
        body: article.sections.map((s) => `## ${s.heading}\n\n${s.body}`).join('\n\n'),
      }
    case 'blog':
    default:
      return { title: article.title, body: article.sections.map((s) => s.body).join('\n\n') }
  }
}

/** One article → multi-channel adaptations (rewritten, not copy-pasted). */
export function buildDistributionBundle(article: ScoutArticleDraft): DistributionDraft[] {
  const channels: DistributionChannel[] = [
    'blog',
    'x_thread',
    'linkedin',
    'telegram',
    'discord',
    'newsletter',
    'reddit',
    'summary',
    'medium',
    'devto',
    'hashnode',
  ]
  const now = new Date().toISOString()
  return channels.map((channel) => {
    const adapted = rewriteForChannel(article, channel)
    return {
      id: randomUUID(),
      articleId: article.id,
      channel,
      title: adapted.title,
      body: adapted.body,
      status: article.status === 'published' ? 'published' : 'draft',
      adaptedAt: now,
    }
  })
}
