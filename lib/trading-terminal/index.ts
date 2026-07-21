export {
  TERMINAL_BASE_PATH,
  COMPLIANCE_DISCLAIMER,
  FEE_DISCLOSURE_PATH,
  TERMS_PATH,
  SOL_MINT,
  CHART_MODES,
  FOCUS_REBIND_BUDGET_MS,
  WORKSPACE_STORAGE_KEY,
  WATCHLIST_STORAGE_KEY,
  COACH_MUTES_STORAGE_KEY,
  COACH_OVERRIDE_LOG_KEY,
  TIT_DND_MIME,
  coverageToBand,
  type ChartMode,
} from './constants'
export type {
  TerminalVerdict,
  ConfidenceBand,
  EvidenceBullet,
  TokenVerdictCard,
  ChartSlotState,
  TerminalFocusState,
  PortfolioStripData,
} from './types'
export { scanToVerdictCard } from './map-verdict'
export {
  evaluateCoachInterrupts,
  hasHardBlock,
  hasSoftGate,
  loadMutes,
  saveMute,
  appendOverrideLog,
  parseOverrideLog,
  loadOverrideLog,
  summarizeOverrideLog,
  type CoachInterrupt,
  type InterruptTriggerId,
  type InterruptContext,
  type OverrideLogEntry,
  type OverrideLogSummary,
} from './coach-interrupt'
export {
  buildWeeklyBrief,
  startOfUtcWeek,
  briefNumberFromWeekStart,
  type WeeklyBriefPayload,
  type BriefSection,
} from './weekly-brief'
export {
  parseTradeLog,
  loadTradeLog,
  appendTrade,
  type TerminalTradeEntry,
} from './trade-log'
export {
  detectBehaviorPatterns,
  type BehaviorFinding,
  type BehaviorPatternId,
  type BehaviorContext,
} from './behavior'
export {
  canArmSniper,
  defaultSniperState,
  parseSniperState,
  loadSniperState,
  saveSniperState,
  type SniperArmState,
} from './sniper-state'
export { evaluateSniperAbort, type SniperAbortReason } from './sniper-abort'
export { pickMarkFromDexPayload, type MarkQuote } from './mark-price'
export {
  computeTradeOutcome,
  summarizeOutcomes,
  type TradeOutcome,
  type TradeOutcomeStatus,
} from './trade-outcomes'
export {
  parseWorkspace,
  loadWorkspace,
  saveWorkspace,
  emptySlots,
  type PersistedWorkspace,
} from './workspace-storage'
export {
  parseWatchlists,
  loadWatchlists,
  saveWatchlists,
  upsertWatchlistItem,
  removeWatchlistItem,
  cycleWatchlistId,
  defaultWatchlists,
  type WatchlistItem,
  type TerminalWatchlist,
  type PersistedWatchlists,
} from './watchlist-storage'
export { encodeTitDrag, decodeTitDrag, type TitDragPayload } from './dnd'
export { buildCoachAction, type CoachAction } from './coach-action'
export { buildCoachTradePlan, type CoachTradePlan, type TradePlanRiskLevel } from './coach-trade-plan'
export { computePortfolioImpact, type PortfolioImpact } from './portfolio-impact'
export { loadSimilarSetups, type SimilarSetups } from './similar-setups'
export { loadWeeklyIntel, type WeeklyIntel } from './weekly-intel'
export {
  awaitingStat,
  loadingStat,
  type MarketStat,
  type MarketStatId,
} from './market-stats'
export {
  DEFAULT_CHART_ENGINE,
  CHART_TIMEFRAMES,
  dexscreenerEmbedUrl,
  type ChartEngineId,
  type ChartTimeframe,
} from './chart-engine'
