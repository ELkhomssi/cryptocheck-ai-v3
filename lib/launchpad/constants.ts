/** Launchpad product surface — UI name is "Launchpad" (route lives under `/dashboard/launchpad/*`). */

export const LAUNCHPAD_BASE_PATH = '/dashboard/launchpad'

export const LAUNCHPAD_NAV = {
  home: LAUNCHPAD_BASE_PATH,
  /** Handoff to unified Action Panel — no legacy mini-swap. */
  swap: '/dashboard?mode=swap#action-panel',
  sniper: '/dashboard?mode=sniper#action-panel',
  saves: `${LAUNCHPAD_BASE_PATH}/saves`,
  fees: `${LAUNCHPAD_BASE_PATH}/fees`,
} as const

export const LAUNCHPAD_COMPLIANCE =
  'Not financial advice · DYOR. Fees route on-chain via Jupiter. Flagged tokens are labeled, not hidden. Non-custodial — your wallet signs.'

export const LAUNCHPAD_FEE_NOTE =
  'Fee routes on-chain via Jupiter. Non-custodial — your wallet signs.'

/** Redis verdict cache — NOT scan:v2 (frozen). */
export const VERDICT_CACHE_PREFIX = 'ccai:sig:verdict:'
export const VERDICT_CACHE_TTL_SEC = Number(process.env.LAUNCHPAD_VERDICT_TTL_SEC ?? 600)

export const LAUNCHPAD_MIN_LIQUIDITY_USD = Number(process.env.LAUNCHPAD_MIN_LIQUIDITY_USD ?? 500)
export const LAUNCHPAD_MIN_AGE_SEC = Number(process.env.LAUNCHPAD_MIN_AGE_SEC ?? 0)

/** Priority fee for snipe landing (lamports). 0 = off. */
export const SNIPER_PRIORITY_FEE_LAMPORTS = Number(process.env.SNIPER_PRIORITY_FEE_LAMPORTS ?? 0)
/** Optional Jito tip lamports on snipe builds. 0 = off. */
export const SNIPER_JITO_TIP_LAMPORTS = Number(process.env.SNIPER_JITO_TIP_LAMPORTS ?? 0)
