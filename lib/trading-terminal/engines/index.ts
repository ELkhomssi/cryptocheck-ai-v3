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
