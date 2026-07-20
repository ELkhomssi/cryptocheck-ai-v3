export type {
  OpportunitySource,
  ExecutionStrategyMode,
  RiskCategory,
  ExecutionPhase,
  ExecutionTerminalStatus,
  OpportunityIntake,
  RiskValidationReport,
  SimulationReport,
  ExecutionSafetyScore,
  CapitalPolicy,
  CapitalCheckResult,
  JitoBundlePlan,
  ExecutionSubmitResult,
  ExecutionAuditRecord,
  StrategyConfig,
} from './types'

export {
  DEFAULT_CAPITAL_POLICY,
  DEFAULT_STRATEGY_CONFIGS,
  riskCategoryFromScore,
} from './types'

export type {
  OpportunityIntakePort,
  RiskValidationPort,
  CapitalManagementPort,
  SimulationPort,
  SafetyPort,
  StrategyPort,
  JitoExecutionPort,
  AuditPort,
  MetricsPort,
  ExecutionEnginePorts,
  PreparedExecution,
} from './ports'

export { loadCapitalPolicy, checkCapitalLimits, recordCapitalFill } from './capital'
export { validateOpportunityRisk, computeSafetyScore, assessBuyIntentCompat } from './risk-adapter'
export {
  planJitoExecution,
  jitoPrioritizationOption,
  congestionFromRecentSlotLag,
} from './jito'
export type { CongestionLevel } from './jito'
export { prepareExecution, decodeUnsignedTx } from './pipeline'
export { execMetricInc, execMetricObserve, renderExecMetricsPrometheus, EXEC_METRICS } from './metrics'
export {
  insertOpportunity,
  insertAuditFromPrepare,
  finalizeAuditWithSignature,
  preparedToAuditStatus,
} from './audit-store'
