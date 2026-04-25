export type DeveloperTierId = 'pro-developer' | 'enterprise'

export type DeveloperTier = {
  id: DeveloperTierId
  name: string
  displayName: string
  priceUsd: number
  priceSol: number
  priceUsdc: number
  billing: 'monthly' | 'custom'
  features: string[]
  apiVersion: 'v1' | 'v2'
  monthlyRequestsLimit: number | 'unlimited'
  supportType: 'email' | 'priority' | 'custom'
  paymentMethods: ('card' | 'sol' | 'usdc' | 'invoice')[]
  badge?: { text: string; variant: 'developer' | 'enterprise' }
  ctaVariant: 'payment' | 'contact-sales'
}

export const DEVELOPER_TIERS: DeveloperTier[] = [
  {
    id: 'pro-developer',
    name: 'PRO DEVELOPER',
    displayName: 'Pro Developer',
    priceUsd: 29,
    priceSol: 0.29,
    priceUsdc: 29,
    billing: 'monthly',
    features: [
      'API access (v1 keys)',
      '10,000 requests per month',
      'Standard rate limits',
      'Dashboard analytics',
      'Scan history & exports',
      'Email support (48h)',
    ],
    apiVersion: 'v1',
    monthlyRequestsLimit: 10000,
    supportType: 'email',
    paymentMethods: ['card', 'sol', 'usdc'],
    ctaVariant: 'payment',
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    displayName: 'Enterprise',
    priceUsd: 299,
    priceSol: 2.99,
    priceUsdc: 299,
    billing: 'monthly',
    features: [
      'Everything in Pro Developer',
      'API access (v2 Sentinel keys)',
      'Unlimited requests',
      'Custom rate limits',
      'SLA 99.9% uptime',
      'Priority support (Slack)',
      'Custom webhook integrations',
      'White-label option',
      'Annual contracts available',
    ],
    apiVersion: 'v2',
    monthlyRequestsLimit: 'unlimited',
    supportType: 'custom',
    paymentMethods: ['card', 'invoice'],
    badge: { text: 'ENTERPRISE', variant: 'enterprise' },
    ctaVariant: 'contact-sales',
  },
]
