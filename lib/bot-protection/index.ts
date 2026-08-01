export {
  SEARCH_ENGINE_ALLOWLIST,
  AI_SCRAPER_PATTERNS,
  isSearchEngineCrawler,
  isAiScraper,
  isHeadlessUa,
} from '@/lib/bot-protection/allowlists'
export {
  computeBotScore,
  headerAnomalyFromHeaders,
  resolveConfig,
  DEFAULT_BOT_CONFIG,
} from '@/lib/bot-protection/score'
export { runEdgeBotProtection } from '@/lib/bot-protection/edge'
export { evaluateApiBotGuard, assertApiReplayProtection } from '@/lib/bot-protection/api-guard'
export type {
  BotDecision,
  BotLogEvent,
  BotScoreResult,
  DefenseStage,
  UserTier,
} from '@/lib/bot-protection/types'
