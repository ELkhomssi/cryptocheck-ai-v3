/**
 * Execution engine service interfaces — implement against existing CryptoCheck
 * primitives (scan-gateway, risk-gated-swap, jupiter-client, swap-simulation).
 *
 * Non-custodial invariant: build/submit returns UNSIGNED txs (or Jito bundle
 * of user-signed txs). The engine never holds Solana key material.
 */

import type {
  CapitalCheckResult,
  CapitalPolicy,
  ExecutionAuditRecord,
  ExecutionSafetyScore,
  ExecutionSubmitResult,
  JitoBundlePlan,
  OpportunityIntake,
  RiskValidationReport,
  SimulationReport,
  StrategyConfig,
} from './types'

export interface OpportunityIntakePort {
  /** Normalize LaunchLab / Alpha / manual / API into OpportunityIntake. */
  accept(raw: unknown): Promise<OpportunityIntake>
}

export interface RiskValidationPort {
  validate(opp: OpportunityIntake): Promise<RiskValidationReport>
}

export interface CapitalManagementPort {
  getPolicy(userId: string): Promise<CapitalPolicy>
  check(opp: OpportunityIntake, policy: CapitalPolicy): Promise<CapitalCheckResult>
  /** After fill / reject — update exposure book. */
  recordFill(opp: OpportunityIntake, signature: string, pnlSolDelta: number): Promise<void>
}

export interface SimulationPort {
  /** Build candidate Jupiter tx (unsigned) then RPC-simulate. */
  simulate(opp: OpportunityIntake, risk: RiskValidationReport): Promise<SimulationReport>
}

export interface SafetyPort {
  score(opp: OpportunityIntake, risk: RiskValidationReport, sim: SimulationReport): Promise<ExecutionSafetyScore>
}

export interface StrategyPort {
  /** May delay (post-dump / liquidity confirm) or abort if structure fails. */
  awaitEntry(opp: OpportunityIntake, cfg: StrategyConfig): Promise<{ proceed: boolean; reason?: string }>
}

export interface JitoExecutionPort {
  plan(opp: OpportunityIntake, congestionScore: number): Promise<JitoBundlePlan>
  /**
   * Prefer: attach tip via Jupiter prioritizationFeeLamports.jitoTipLamports,
   * then optional bundle submit of *already user-signed* txs.
   * Fallback: standard RPC send after wallet sign.
   */
  submitSigned(
    signedTxBase64: string,
    plan: JitoBundlePlan,
  ): Promise<ExecutionSubmitResult>
}

export interface AuditPort {
  start(opp: OpportunityIntake): Promise<ExecutionAuditRecord>
  patch(id: string, patch: Partial<ExecutionAuditRecord>): Promise<ExecutionAuditRecord>
  finalize(id: string, status: ExecutionAuditRecord['status']): Promise<ExecutionAuditRecord>
}

export interface MetricsPort {
  inc(name: string, labels?: Record<string, string>): void
  observe(name: string, value: number, labels?: Record<string, string>): void
}

export type ExecutionEnginePorts = {
  intake: OpportunityIntakePort
  risk: RiskValidationPort
  capital: CapitalManagementPort
  simulation: SimulationPort
  safety: SafetyPort
  strategy: StrategyPort
  jito: JitoExecutionPort
  audit: AuditPort
  metrics: MetricsPort
}

/** Pipeline result handed to the client for wallet sign (non-custodial). */
export type PreparedExecution = {
  auditId: string
  opportunityId: string
  allowed: boolean
  blockReason?: string
  unsignedTxBase64?: string
  risk: RiskValidationReport
  simulation: SimulationReport | null
  safety: ExecutionSafetyScore | null
  capital: CapitalCheckResult | null
  jitoPlan: JitoBundlePlan | null
  platformFeeDisclosure?: Record<string, unknown>
}
