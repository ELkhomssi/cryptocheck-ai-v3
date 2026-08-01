export type DefenseStage = 0 | 1 | 2 | 3 | 4 | 5

export type BotDecision =
  | 'allow'
  | 'slow'
  | 'js_challenge'
  | 'challenge'
  | 'temp_block'
  | 'blacklist'

export type UserTier = 'anonymous' | 'logged' | 'premium' | 'search_engine' | 'api_key'

export type BotScoreResult = {
  /** 0 = human/trusted, 100 = definite malicious bot */
  botScore: number
  decision: BotDecision
  stage: DefenseStage
  reasons: string[]
  crawlerAllowlisted: boolean
  aiScraper: boolean
  tier: UserTier
}

export type BotLogEvent = {
  ip: string | null
  asn: string | null
  country: string | null
  userAgent: string | null
  botScore: number
  reason: string
  path: string
  decision: BotDecision
  timestamp: string
}

export type BotProtectionConfig = {
  enabled: boolean
  aiScraperMode: 'allow' | 'throttle' | 'block'
  /** BotScore thresholds for progressive stages */
  stage1Min: number
  stage2Min: number
  stage3Min: number
  stage4Min: number
  stage5Min: number
}
