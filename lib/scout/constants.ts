import { SCOUT_PRODUCT_PATHS } from '@/lib/scout/strategy'

export const SCOUT_AGENT_ID = 'scout'
export const SCOUT_REDIS_PREFIX = 'ccai:scout:'
export const SCOUT_STATE_KEY = `${SCOUT_REDIS_PREFIX}state`
export const SCOUT_PLAN_KEY = `${SCOUT_REDIS_PREFIX}plan:today`
export const SCOUT_QUEUE_KEY = `${SCOUT_REDIS_PREFIX}queue`
export const SCOUT_LEARNING_KEY = `${SCOUT_REDIS_PREFIX}learning`
export const SCOUT_METRICS_KEY = `${SCOUT_REDIS_PREFIX}metrics`

/**
 * V2 default: autonomous publish after quality gates.
 * Set SCOUT_AUTO_PUBLISH=0 to require manual approval.
 */
export const SCOUT_AUTO_PUBLISH = process.env.SCOUT_AUTO_PUBLISH !== '0'

export const SCOUT_INTERNAL_LINKS = SCOUT_PRODUCT_PATHS

export const SCOUT_DISCLAIMER =
  'Not financial advice · DYOR. Content is informational and derived from CryptoCheckAI engine outputs at the time of generation. Scout never promises profits.'
