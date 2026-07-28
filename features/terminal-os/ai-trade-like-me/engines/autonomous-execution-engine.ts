/**
 * Autonomous Execution Engine V2 — plans + audit log only while flags OFF.
 * Audit log is a product surface (trust artifact), not a hidden table.
 */

import {
  isAutonomousAllowed,
  isExecutionAllowed,
} from '@/features/terminal-os/shared/lib/feature-flags'
import type { FeatureFlags } from '@/features/terminal-os/shared/types'
import type {
  AutonomyAuditEntry,
  AutonomousPlan,
  AutonomyConfig,
  ExplainableDecision,
  TraderDna,
} from '../types'
import type { TlmEventBus } from './event-bus'

export const DEFAULT_AUTONOMY_CONFIG: AutonomyConfig = {
  enabled: false,
  confidenceThreshold: 85,
  maxPositionUsd: 500,
  maxDailyLossPct: 3,
  maxDailyActions: 10,
  allowedChains: ['solana', 'ethereum', 'base', 'bnb'],
  requireConfirmation: true,
  mandatoryStopLossPct: 12,
}

export class AutonomousExecutionEngine {
  private config: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG }
  private auditLog: AutonomyAuditEntry[] = []
  private dailyActions = 0

  constructor(private readonly bus: TlmEventBus) {}

  getConfig() {
    return { ...this.config }
  }

  getAuditLog() {
    return [...this.auditLog]
  }

  updateConfig(patch: Partial<AutonomyConfig>) {
    this.config = { ...this.config, ...patch }
  }

  private writeAudit(
    decision: ExplainableDecision,
    dna: TraderDna | null,
    tier: string,
    wouldExecute: boolean,
    blockedReason: string | null,
  ): AutonomyAuditEntry {
    const entry: AutonomyAuditEntry = {
      id: `audit-${decision.id}`,
      at: new Date().toISOString(),
      opportunity: decision.opportunity,
      dnaSnapshot: {
        confidence: dna?.confidence ?? 0,
        sampleSize: dna?.sampleSize ?? 0,
        styleVector: dna?.styleVector ?? {
          momentum: 0,
          scalper: 0,
          swingTrader: 0,
          narrativeTrader: 0,
          whaleFollower: 0,
          meanReversion: 0,
          breakoutTrader: 0,
          liquidityHunter: 0,
        },
        riskAppetite: dna?.riskAppetite ?? 0,
      },
      permissionTier: tier,
      explanation: decision.summary,
      plannedAction: decision.action,
      wouldExecute,
      blockedReason,
    }
    this.auditLog = [entry, ...this.auditLog].slice(0, 100)
    return entry
  }

  plan(
    decision: ExplainableDecision | null,
    flags: FeatureFlags,
    dna: TraderDna | null = null,
    tier = 'advise_only',
  ): AutonomousPlan {
    if (!decision) {
      return {
        armed: false,
        blockedReason: 'No decision yet',
        plannedAction: null,
        wouldExecute: false,
        config: this.getConfig(),
        audit: null,
      }
    }

    if (!isAutonomousAllowed(flags) || !this.config.enabled) {
      const blocked =
        'Autonomous Mode flagged OFF — advise-only. Enable autonomousTrading + user toggle for Phase 6.'
      const audit = this.writeAudit(decision, dna, tier, false, blocked)
      const plan: AutonomousPlan = {
        armed: false,
        blockedReason: blocked,
        plannedAction: decision.action,
        wouldExecute: false,
        config: this.getConfig(),
        audit,
      }
      this.bus.publish('ExecutionBlocked', plan, 'AutonomousExecutionEngine')
      return plan
    }

    if (!isExecutionAllowed(flags)) {
      const blocked = 'realSwapExecution flagged OFF — no custody / no auto-send.'
      const audit = this.writeAudit(decision, dna, tier, false, blocked)
      this.bus.publish('ExecutionBlocked', { blocked }, 'AutonomousExecutionEngine')
      return {
        armed: false,
        blockedReason: blocked,
        plannedAction: decision.action,
        wouldExecute: false,
        config: this.getConfig(),
        audit,
      }
    }

    if (decision.scores.confidence < this.config.confidenceThreshold) {
      const blocked = `Confidence ${decision.scores.confidence}% below threshold ${this.config.confidenceThreshold}%`
      const audit = this.writeAudit(decision, dna, tier, false, blocked)
      return {
        armed: true,
        blockedReason: blocked,
        plannedAction: decision.action,
        wouldExecute: false,
        config: this.getConfig(),
        audit,
      }
    }

    if (this.dailyActions >= this.config.maxDailyActions) {
      const blocked = `Daily action cap ${this.config.maxDailyActions} reached`
      const audit = this.writeAudit(decision, dna, tier, false, blocked)
      return {
        armed: true,
        blockedReason: blocked,
        plannedAction: decision.action,
        wouldExecute: false,
        config: this.getConfig(),
        audit,
      }
    }

    if (!this.config.allowedChains.includes(decision.chain as AutonomyConfig['allowedChains'][number])) {
      const blocked = `Chain ${decision.chain} not in allowed set`
      const audit = this.writeAudit(decision, dna, tier, false, blocked)
      return {
        armed: true,
        blockedReason: blocked,
        plannedAction: decision.action,
        wouldExecute: false,
        config: this.getConfig(),
        audit,
      }
    }

    const wouldExecute =
      !this.config.requireConfirmation &&
      decision.action !== 'DO_NOTHING' &&
      decision.action !== 'WAIT'

    const blockedReason = this.config.requireConfirmation
      ? 'Would execute after user confirmation (bounded autonomy)'
      : null

    const audit = this.writeAudit(decision, dna, tier, wouldExecute, blockedReason)
    if (wouldExecute) {
      this.dailyActions += 1
      this.bus.publish('ExecutionCompleted', { auditId: audit.id, simulated: true }, 'AutonomousExecutionEngine')
    }

    return {
      armed: true,
      blockedReason,
      plannedAction: decision.action,
      wouldExecute,
      config: this.getConfig(),
      audit,
    }
  }
}
