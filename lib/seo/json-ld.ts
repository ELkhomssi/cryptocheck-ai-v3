import { SITE_LEGAL_NAME, SITE_NAME, absoluteUrl, getSiteUrl } from '@/lib/seo/site'

export type JsonLd = Record<string, unknown> | Record<string, unknown>[]

export function homeJsonLd(): JsonLd {
  const site = getSiteUrl()
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_LEGAL_NAME,
      legalName: SITE_LEGAL_NAME,
      url: site,
      logo: absoluteUrl('/logo.jpg'),
      sameAs: [],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: site,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${site}/scanner?mint={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      url: site,
      description:
        'AI-powered crypto trading platform with Intelligence Charts, Security Scanner, Wallet Analysis, Smart Money Tracking, AI Coaching and Autonomous Execution.',
      offers: {
        '@type': 'Offer',
        url: absoluteUrl('/pricing'),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    },
  ]
}

export function tokenJsonLd(input: {
  mint: string
  name: string
  symbol?: string | null
  description: string
  verdict?: string | null
  safetyScore?: number | null
  scannedAt?: string | null
}): JsonLd {
  const url = absoluteUrl(`/token/${input.mint}`)
  const date = input.scannedAt ?? new Date().toISOString()
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `${input.name} (${input.symbol ?? 'TOKEN'}) Solana Security Scan`,
      description: input.description,
      url,
      mainEntityOfPage: url,
      dateModified: date,
      datePublished: date,
      author: { '@type': 'Organization', name: SITE_LEGAL_NAME },
      publisher: {
        '@type': 'Organization',
        name: SITE_LEGAL_NAME,
        logo: { '@type': 'ImageObject', url: absoluteUrl('/logo.jpg') },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `${input.name} risk dataset`,
      description: input.description,
      url,
      identifier: input.mint,
      keywords: ['solana', 'token risk', input.verdict ?? 'scan', 'CryptoCheckAI'].filter(Boolean),
      creator: { '@type': 'Organization', name: SITE_LEGAL_NAME },
      variableMeasured: [
        input.safetyScore != null
          ? { '@type': 'PropertyValue', name: 'safetyScore', value: input.safetyScore }
          : undefined,
        input.verdict
          ? { '@type': 'PropertyValue', name: 'verdict', value: input.verdict }
          : undefined,
      ].filter(Boolean),
    },
  ]
}

export function walletJsonLd(input: {
  address: string
  label?: string | null
  description: string
  tier?: string | null
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: input.label ? `${input.label} · Solana wallet` : `Solana wallet ${input.address.slice(0, 4)}…${input.address.slice(-4)}`,
    description: input.description,
    url: absoluteUrl(`/wallet/${input.address}`),
    mainEntity: {
      '@type': 'Person',
      name: input.label ?? input.address,
      identifier: input.address,
      description: input.tier ? `Smart-money tier: ${input.tier}` : undefined,
    },
  }
}

export function reportJsonLd(input: {
  id: string
  title: string
  description: string
  createdAt: string
  reportType?: string | null
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: input.title,
    description: input.description,
    url: absoluteUrl(`/report/${input.id}`),
    datePublished: input.createdAt,
    dateModified: input.createdAt,
    about: input.reportType ?? 'CryptoCheckAI intelligence report',
    author: { '@type': 'Organization', name: SITE_LEGAL_NAME },
    publisher: { '@type': 'Organization', name: SITE_LEGAL_NAME },
  }
}

export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
