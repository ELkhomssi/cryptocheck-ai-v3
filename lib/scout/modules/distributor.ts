import { randomUUID } from 'crypto'
import { SCOUT_DISCLAIMER } from '@/lib/scout/constants'
import type { DistributionChannel, DistributionDraft, ScoutArticleDraft } from '@/lib/scout/types'

function rewriteForChannel(article: ScoutArticleDraft, channel: DistributionChannel): { title: string; body: string } {
  const symbol = article.mint ? article.mint.slice(0, 4) + '…' : article.keywords[0] || 'Solana'
  switch (channel) {
    case 'x_thread':
      return {
        title: `Thread: ${article.title}`.slice(0, 80),
        body: [
          `1/ ${article.title}`,
          `2/ Context: ${article.introduction.slice(0, 220)}`,
          `3/ Security stance: ${article.securityAnalysis.slice(0, 220)}`,
          `4/ Dig deeper → cryptocheckai.com/scanner`,
          `5/ ${SCOUT_DISCLAIMER}`,
        ].join('\n\n'),
      }
    case 'linkedin':
      return {
        title: article.title,
        body: [
          article.introduction,
          '',
          'Key takeaways from CryptoCheckAI engines (not social rumor):',
          `• ${article.marketContext.slice(0, 180)}`,
          `• ${article.cryptocheckIntelligence.slice(0, 180)}`,
          '',
          SCOUT_DISCLAIMER,
        ].join('\n'),
      }
    case 'telegram':
      return {
        title: `Scout · ${symbol}`,
        body: `*${article.title}*\n\n${article.introduction.slice(0, 400)}\n\nRead: /blog/${article.slug}\n${SCOUT_DISCLAIMER}`,
      }
    case 'discord':
      return {
        title: article.title,
        body: `**${article.title}**\n${article.introduction.slice(0, 350)}\n→ https://www.cryptocheckai.com/blog/${article.slug}`,
      }
    case 'newsletter':
      return {
        title: `CryptoCheckAI Scout — ${article.title}`,
        body: [article.introduction, article.marketContext, article.conclusion, SCOUT_DISCLAIMER].join(
          '\n\n',
        ),
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
      status: 'draft',
      adaptedAt: now,
    }
  })
}
