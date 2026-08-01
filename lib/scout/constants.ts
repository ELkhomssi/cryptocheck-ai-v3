export const SCOUT_AGENT_ID = 'scout'
export const SCOUT_REDIS_PREFIX = 'ccai:scout:'
export const SCOUT_STATE_KEY = `${SCOUT_REDIS_PREFIX}state`
export const SCOUT_PLAN_KEY = `${SCOUT_REDIS_PREFIX}plan:today`
export const SCOUT_QUEUE_KEY = `${SCOUT_REDIS_PREFIX}queue`
export const SCOUT_LEARNING_KEY = `${SCOUT_REDIS_PREFIX}learning`

/** Default approval mode — auto publish is opt-in via env. */
export const SCOUT_AUTO_PUBLISH = process.env.SCOUT_AUTO_PUBLISH === '1'

export const SCOUT_INTERNAL_LINKS = [
  { href: '/scanner', anchor: 'Security Scanner' },
  { href: '/terminalOS', anchor: 'Terminal OS' },
  { href: '/pricing', anchor: 'Pricing' },
  { href: '/docs', anchor: 'Developer documentation' },
  { href: '/security', anchor: 'Security model' },
  { href: '/blog', anchor: 'CryptoCheckAI Blog' },
  { href: '/market-intel', anchor: 'Market Intelligence' },
  { href: '/trade-like-me', anchor: 'Trade Like Me' },
] as const

export const SCOUT_DISCLAIMER =
  'Not financial advice · DYOR. Content is informational and derived from CryptoCheckAI engine outputs at the time of generation.'
