import type { Metadata } from 'next'
import {
  DEFAULT_OG_IMAGE_PATH,
  HOME_KEYWORDS,
  SITE_LEGAL_NAME,
  SITE_NAME,
  absoluteUrl,
  getSiteUrl,
} from '@/lib/seo/site'

type BuildPageMetadataInput = {
  title: string
  description: string
  path: string
  keywords?: string[]
  images?: string[]
  type?: 'website' | 'article' | 'profile'
  noIndex?: boolean
}

export function buildPageMetadata(input: BuildPageMetadataInput): Metadata {
  const url = absoluteUrl(input.path)
  const images = (input.images?.length ? input.images : [DEFAULT_OG_IMAGE_PATH]).map((src) =>
    src.startsWith('http') ? src : absoluteUrl(src),
  )

  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    alternates: { canonical: url },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: SITE_NAME,
      type: input.type === 'article' ? 'article' : 'website',
      locale: 'en_US',
      images: images.map((image) => ({ url: image, width: 1200, height: 630, alt: input.title })),
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images,
    },
  }
}

export function buildRootMetadata(): Metadata {
  // Prefer production host for canonicals/OG when Vercel Production, or when
  // SITE_URL is unset/localhost — avoids shipping localhost canonicals.
  const raw = getSiteUrl()
  const siteUrl =
    process.env.VERCEL_ENV === 'production' ||
    !raw ||
    raw.includes('localhost') ||
    raw.includes('127.0.0.1')
      ? `https://www.cryptocheckai.com`
      : raw
  const title = 'CryptoCheckAI — AI Operating System for Crypto Traders'
  const description =
    'AI-powered crypto trading platform with Intelligence Charts, Security Scanner, Wallet Analysis, Smart Money Tracking, AI Coaching and Autonomous Execution.'
  const verificationToken = process.env.GOOGLE_SITE_VERIFICATION?.trim()

  return {
    metadataBase: new URL(siteUrl),
    icons: { icon: '/logo.jpg', apple: '/logo.jpg' },
    title: {
      default: title,
      template: `%s · ${SITE_NAME}`,
    },
    description,
    keywords: [...HOME_KEYWORDS],
    authors: [{ name: SITE_LEGAL_NAME }],
    creator: SITE_LEGAL_NAME,
    publisher: SITE_LEGAL_NAME,
    applicationName: SITE_NAME,
    alternates: { canonical: absoluteUrl('/') },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl('/'),
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_US',
      images: [
        {
          url: absoluteUrl(DEFAULT_OG_IMAGE_PATH),
          width: 1200,
          height: 630,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absoluteUrl(DEFAULT_OG_IMAGE_PATH)],
    },
    ...(verificationToken
      ? {
          verification: {
            google: verificationToken,
          },
        }
      : {}),
  }
}
