/**
 * Intelligence engines — PART II surface.
 * All scores: measured inputs + method + confidence. Else insufficient / silent.
 */

export {
  OPPORTUNITY_WEIGHTS,
  classifyStage,
  scoreOpportunity,
  rankOpportunities,
  buildOpportunityReasons,
  type Opportunity,
  type OpportunityMeasuredInputs,
  type OpportunityStage,
  type OpportunityRisk,
} from './opportunity-engine'

export {
  buildActionQueue,
  toCoachActionRows,
  type QueuedAction,
  type ActionType,
} from './action-queue'

export {
  buildWalletCoachNudges,
  type CoachNudge,
  type CoachNudgeKind,
} from './wallet-coach'

export {
  attributeOpportunity,
  type CausalAttribution,
  type AttributionShare,
  type AttributionFactor,
} from './causal-attribution'

export {
  buildTerminalAlerts,
  filterAlerts,
  DEFAULT_ALERT_PREFS,
  type TerminalAlert,
  type TerminalAlertSeverity,
  type AlertPrefs,
} from './alerts-engine'

export {
  resolveIntelligence,
  type IntelligenceBundle,
} from './resolve-intelligence'

export {
  detectMarketStructure,
  type MarketStructureResult,
  type StructureLabel,
  type StructureLabelKind,
  type StructureBias,
} from './market-structure'
