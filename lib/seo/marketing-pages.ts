export type MarketingPageDef = {
  path: string
  title: string
  description: string
  headline: string
  support: string
  primaryCta: { href: string; label: string }
  secondaryCta?: { href: string; label: string }
  keywords: string[]
}

export const MARKETING_PAGES: MarketingPageDef[] = [
  {
    path: '/execution',
    title: 'Autonomous Execution — CryptoCheckAI',
    description:
      'Risk-gated Solana execution desk with simulation, slippage controls, and platform fee transparency before every swap.',
    headline: 'Autonomous Execution',
    support:
      'Prepare and simulate trades with CryptoCheckAI risk gates — non-custodial, wallet-signed, never auto-armed on DANGER verdicts.',
    primaryCta: { href: '/terminalOS', label: 'Open Terminal OS' },
    secondaryCta: { href: '/docs', label: 'Developer docs' },
    keywords: ['solana execution', 'risk gated swap', 'AI trading', 'CryptoCheckAI'],
  },
  {
    path: '/discovery',
    title: 'Discovery Desk — CryptoCheckAI',
    description:
      'Discover Solana tokens with AI-assisted screening, security context, and smart-money aware discovery workflows.',
    headline: 'Discovery Desk',
    support:
      'Surface new Solana opportunities with scanner-backed context before you route into deeper analysis or execution.',
    primaryCta: { href: '/terminalOS', label: 'Open Discovery' },
    secondaryCta: { href: '/scanner', label: 'Run a scan' },
    keywords: ['solana discovery', 'token screener', 'crypto AI', 'CryptoCheckAI'],
  },
  {
    path: '/scanner',
    title: 'Solana Security Scanner — CryptoCheckAI',
    description:
      'Institutional-grade Solana rug checker and token security scanner with AI risk verdicts and evidence lines.',
    headline: 'Security Scanner',
    support:
      'Scan any Solana mint for rug risk, liquidity red flags, and evidence-backed SAFE / CAUTION / DANGER verdicts.',
    primaryCta: { href: '/app', label: 'Scan a token' },
    secondaryCta: { href: '/docs', label: 'Scanner API' },
    keywords: ['solana scanner', 'rug checker', 'token scanner', 'crypto security'],
  },
  {
    path: '/market-intel',
    title: 'Market Intelligence — CryptoCheckAI',
    description:
      'Market intelligence charts and smart-money context for Solana traders inside the CryptoCheckAI operating system.',
    headline: 'Market Intelligence',
    support:
      'Track market structure, whale flow, and intelligence charts without leaving the CryptoCheckAI terminal.',
    primaryCta: { href: '/terminalOS', label: 'Open Market Intel' },
    secondaryCta: { href: '/pricing', label: 'View pricing' },
    keywords: ['market intelligence', 'smart money', 'solana charts', 'CryptoCheckAI'],
  },
  {
    path: '/ai-coach',
    title: 'AI Coach — CryptoCheckAI',
    description:
      'AI coaching for crypto traders grounded in portfolio context, risk verdicts, and honest activity windows.',
    headline: 'AI Coach',
    support:
      'Get portfolio-aware coaching that refuses to invent edge — built for Solana traders who want disciplined AI assistance.',
    primaryCta: { href: '/terminalOS', label: 'Open AI Coach' },
    secondaryCta: { href: '/about', label: 'About CryptoCheckAI' },
    keywords: ['AI coach', 'crypto AI', 'trading coach', 'solana portfolio'],
  },
  {
    path: '/trade-like-me',
    title: 'Trade Like Me — CryptoCheckAI',
    description:
      'Mirror smart-money style workflows with CryptoCheckAI Trade Like Me — analysis first, execution always risk-gated.',
    headline: 'Trade Like Me',
    support:
      'Study high-signal wallet behaviors and route ideas into the same risk-gated execution path used across Terminal OS.',
    primaryCta: { href: '/terminalOS', label: 'Open Trade Like Me' },
    secondaryCta: { href: '/security', label: 'Security model' },
    keywords: ['trade like me', 'smart money', 'wallet analysis', 'CryptoCheckAI'],
  },
  {
    path: '/security',
    title: 'Security — CryptoCheckAI',
    description:
      'How CryptoCheckAI protects traders: non-custodial swaps, risk verdicts, bot defense, and API request integrity.',
    headline: 'Security Model',
    support:
      'Non-custodial by design. Simulate before send. DANGER verdicts stay friction-heavy. Search engines index us — abusive bots do not.',
    primaryCta: { href: '/scanner', label: 'Try the scanner' },
    secondaryCta: { href: '/docs', label: 'API security docs' },
    keywords: ['crypto security', 'rug checker', 'non-custodial', 'bot protection'],
  },
  {
    path: '/pricing',
    title: 'Pricing — CryptoCheckAI',
    description:
      'CryptoCheckAI pricing for AI trading terminal access, scanner APIs, and premium intelligence workflows.',
    headline: 'Pricing',
    support:
      'Start with consumer scanner access, then unlock Terminal OS, API keys, and premium intelligence when you are ready.',
    primaryCta: { href: '/signup', label: 'Create account' },
    secondaryCta: { href: '/docs', label: 'API docs' },
    keywords: ['CryptoCheckAI pricing', 'solana scanner pricing', 'AI trading terminal'],
  },
  {
    path: '/about',
    title: 'About — CryptoCheckAI',
    description:
      'CryptoCheckAI is the AI operating system for crypto traders — scanner, wallet intelligence, coaching, and execution.',
    headline: 'About CryptoCheckAI',
    support:
      'We build institutional-grade Solana intelligence for retail and pro traders who refuse black-box risk.',
    primaryCta: { href: '/', label: 'Explore product' },
    secondaryCta: { href: '/contact', label: 'Contact' },
    keywords: ['CryptoCheckAI', 'about', 'solana AI', 'crypto trading platform'],
  },
  {
    path: '/contact',
    title: 'Contact — CryptoCheckAI',
    description:
      'Contact CryptoCheckAI for product support, partnerships, and developer access to the intelligence APIs.',
    headline: 'Contact',
    support:
      'Reach the CryptoCheckAI team for support, B2B access, and partnership inquiries. See Terms for formal notices.',
    primaryCta: { href: '/terms', label: 'Terms & notices' },
    secondaryCta: { href: '/docs', label: 'Developer docs' },
    keywords: ['contact CryptoCheckAI', 'support', 'partnerships'],
  },
]
