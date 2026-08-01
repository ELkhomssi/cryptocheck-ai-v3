import { SITE_LEGAL_NAME, absoluteUrl } from '@/lib/seo/site'
import type { ScoutArticleDraft, ScoutSeoPayload } from '@/lib/scout/types'

export function buildArticleSeo(article: ScoutArticleDraft): ScoutSeoPayload {
  const path = `/blog/${article.slug}`
  const description = article.introduction.slice(0, 155).replace(/\s+/g, ' ').trim()
  const url = absoluteUrl(path)

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: absoluteUrl('/blog') },
      { '@type': 'ListItem', position: 3, name: article.title, item: url },
    ],
  }

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description,
    datePublished: article.publishedAt || article.createdAt,
    dateModified: article.updatedAt,
    author: { '@type': 'Organization', name: SITE_LEGAL_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_LEGAL_NAME,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/logo.jpg') },
    },
    mainEntityOfPage: url,
    keywords: article.keywords.join(', '),
  }

  return {
    title: article.title.slice(0, 70),
    description,
    canonicalPath: path,
    jsonLd: [articleSchema, faqSchema, breadcrumbSchema],
    faqSchema,
    breadcrumbSchema,
    articleSchema,
  }
}
