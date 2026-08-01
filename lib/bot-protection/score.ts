import {
  isAiScraper,
  isHeadlessUa,
  isSearchEngineCrawler,
} from '@/lib/bot-protection/allowlists'
import type {
  BotDecision,
  BotProtectionConfig,
  BotScoreResult,
  DefenseStage,
  UserTier,
} from '@/lib/bot-protection/types'

export const DEFAULT_BOT_CONFIG: BotProtectionConfig = {
  enabled: true,
  aiScraperMode: 'throttle',
  stage1Min: 40,
  stage2Min: 55,
  stage3Min: 70,
  stage4Min: 85,
  stage5Min: 95,
}

export type ScoreInput = {
  userAgent: string | null
  /** Missing Accept-Language, Sec-Fetch-*, etc. */
  missingBrowserHeaders: boolean
  headerAnomalyScore: number
  /** Requests in last 60s for this IP (from Redis); omit to skip */
  requestsLastMinute?: number
  tier: UserTier
  /** Known blacklist hit */
  blacklisted?: boolean
  /** ASN reputation 0–100 (higher = worse); omit if unknown */
  asnReputation?: number
  /** IP reputation 0–100 (higher = worse) */
  ipReputation?: number
  path: string
  hasApiCredentials: boolean
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): BotProtectionConfig {
  const mode = (env.AI_SCRAPER_MODE || 'throttle').toLowerCase()
  return {
    enabled: env.BOT_PROTECTION_ENABLED !== '0',
    aiScraperMode: mode === 'allow' || mode === 'block' ? mode : 'throttle',
    stage1Min: Number(env.BOT_SCORE_STAGE1 ?? DEFAULT_BOT_CONFIG.stage1Min) || 40,
    stage2Min: Number(env.BOT_SCORE_STAGE2 ?? DEFAULT_BOT_CONFIG.stage2Min) || 55,
    stage3Min: Number(env.BOT_SCORE_STAGE3 ?? DEFAULT_BOT_CONFIG.stage3Min) || 70,
    stage4Min: Number(env.BOT_SCORE_STAGE4 ?? DEFAULT_BOT_CONFIG.stage4Min) || 85,
    stage5Min: Number(env.BOT_SCORE_STAGE5 ?? DEFAULT_BOT_CONFIG.stage5Min) || 95,
  }
}

function decisionFromScore(score: number, cfg: BotProtectionConfig): { decision: BotDecision; stage: DefenseStage } {
  if (score >= cfg.stage5Min) return { decision: 'blacklist', stage: 5 }
  if (score >= cfg.stage4Min) return { decision: 'temp_block', stage: 4 }
  if (score >= cfg.stage3Min) return { decision: 'challenge', stage: 3 }
  if (score >= cfg.stage2Min) return { decision: 'js_challenge', stage: 2 }
  if (score >= cfg.stage1Min) return { decision: 'slow', stage: 1 }
  return { decision: 'allow', stage: 0 }
}

/**
 * Pure BotScore (0–100). Edge-safe, no I/O — designed for &lt;1ms evaluation.
 */
export function computeBotScore(input: ScoreInput, cfg: BotProtectionConfig = DEFAULT_BOT_CONFIG): BotScoreResult {
  const reasons: string[] = []
  const ua = input.userAgent

  if (isSearchEngineCrawler(ua) || input.tier === 'search_engine') {
    return {
      botScore: 0,
      decision: 'allow',
      stage: 0,
      reasons: ['search_engine_allowlist'],
      crawlerAllowlisted: true,
      aiScraper: false,
      tier: 'search_engine',
    }
  }

  // Never interfere with Search Console / verification paths
  if (
    input.path.includes('google') &&
    (input.path.includes('verification') || input.path.includes('site-verification'))
  ) {
    return {
      botScore: 0,
      decision: 'allow',
      stage: 0,
      reasons: ['gsc_verification_path'],
      crawlerAllowlisted: true,
      aiScraper: false,
      tier: input.tier,
    }
  }

  if (input.blacklisted) {
    return {
      botScore: 100,
      decision: 'blacklist',
      stage: 5,
      reasons: ['permanent_blacklist'],
      crawlerAllowlisted: false,
      aiScraper: isAiScraper(ua),
      tier: input.tier,
    }
  }

  let score = 0
  const ai = isAiScraper(ua)

  if (!ua) {
    score += 35
    reasons.push('missing_user_agent')
  } else if (ua.length < 12) {
    score += 20
    reasons.push('short_user_agent')
  }

  if (isHeadlessUa(ua)) {
    score += 40
    reasons.push('headless_or_automation_ua')
  }

  if (input.missingBrowserHeaders && !input.hasApiCredentials && !input.path.startsWith('/api/')) {
    score += 18
    reasons.push('missing_browser_headers')
  }

  if (input.headerAnomalyScore > 0) {
    score += Math.min(25, input.headerAnomalyScore)
    reasons.push('header_anomaly')
  }

  if (input.asnReputation != null && input.asnReputation > 60) {
    score += Math.round((input.asnReputation - 60) * 0.5)
    reasons.push('asn_reputation')
  }

  if (input.ipReputation != null && input.ipReputation > 60) {
    score += Math.round((input.ipReputation - 60) * 0.55)
    reasons.push('ip_reputation')
  }

  // Adaptive frequency by tier
  const rpm = input.requestsLastMinute
  if (rpm != null) {
    const soft =
      input.tier === 'premium' ? 600 : input.tier === 'logged' ? 180 : input.tier === 'api_key' ? 300 : 60
    if (rpm > soft * 2) {
      score += 35
      reasons.push('request_frequency_hard')
    } else if (rpm > soft) {
      score += 18
      reasons.push('request_frequency_soft')
    }
  }

  if (ai) {
    reasons.push('ai_scraper_ua')
    if (cfg.aiScraperMode === 'block') {
      score = Math.max(score, cfg.stage4Min)
    } else if (cfg.aiScraperMode === 'throttle') {
      score = Math.max(score, cfg.stage1Min + 5)
    }
    // allow → no extra score
  }

  // Premium authenticated users: never escalate past slow unless abuse confirmed (score already high)
  if (input.tier === 'premium' && score < cfg.stage4Min) {
    score = Math.min(score, cfg.stage1Min - 1)
    reasons.push('premium_user_cap')
  }

  score = clamp(score)
  const { decision, stage } = decisionFromScore(score, cfg)

  return {
    botScore: score,
    decision,
    stage,
    reasons: reasons.length ? reasons : ['clean'],
    crawlerAllowlisted: false,
    aiScraper: ai,
    tier: input.tier,
  }
}

/** Browser header anomaly heuristics (Edge-safe). */
export function headerAnomalyFromHeaders(headers: Headers, isApi: boolean): {
  missingBrowserHeaders: boolean
  headerAnomalyScore: number
} {
  if (isApi) {
    return { missingBrowserHeaders: false, headerAnomalyScore: 0 }
  }
  const accept = headers.get('accept')
  const acceptLang = headers.get('accept-language')
  const secFetchSite = headers.get('sec-fetch-site')
  let anomaly = 0
  let missing = false
  if (!accept) {
    missing = true
    anomaly += 8
  }
  if (!acceptLang) {
    missing = true
    anomaly += 10
  }
  // Modern Chromium navigations usually send Sec-Fetch-*
  if (!secFetchSite && !headers.get('sec-ch-ua')) {
    anomaly += 6
  }
  return { missingBrowserHeaders: missing, headerAnomalyScore: anomaly }
}
