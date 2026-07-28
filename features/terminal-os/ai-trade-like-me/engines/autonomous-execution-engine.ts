/**
 * Autonomous Execution Engine — plans only while feature flags are OFF.
 * Real swaps must go through risk-gated-swap when Phase 6 enables execution.
 */

import {
  isAutonomousAllowed,
  isExecutionAllowed,
} from '@/features/terminal-os/shared/lib/feature-flags'
import type { FeatureFlags } from '@/features/terminal-os/shared/types'
import type {
  AutonomousPlan,
  AutonomyConfig,
  ExplainableDecision,
} from '../types'
import type { TlmEventBus } from './event-bus'

export const DEFAULT_AUTONOMY_CONFIG: AutonomyConfig = {
  enabled: false,
  confidenceThreshold: 85,
  maxPositionUsd: 500,
  maxDailyLossPct: 3,
  allowedChains: ['solana', 'ethereum', 'base', 'bnb'],
  requireConfirmation: true,
}

export class AutonomousExecutionEngine {
  private config: AutonomyConfig = { ...DEFAULT_AUTONOMY_CONFIG }

  constructor(private readonly bus: TlmEventBus) {}

  getConfig() {
    return { ...this.config }
  }

  updateConfig(patch: Partial<AutonomyConfig>) {
    this.config = { ...this.config, ...patch }
  }

  /**
   * Plan an autonomous action. Never sends transactions here.
   * Returns blocked plan when flags/tier/confidence fail.
   */
  plan(
    decision: ExplainableDecision | null,
    flags: FeatureFlags,
  ): AutonomousPlan {
    if (!decision) {
      return {
        armed: false,
        blockedReason: 'No decision yet',
        plannedAction: null,
        wouldExecute: false,
        config: this.getConfig(),
      }
    }

    if (!isAutonomousAllowed(flags) || !this.config.enabled) {
      const plan: AutonomousPlan = {
        armed: false,
        blockedReason:
          'Autonomous Mode flagged OFF — advise-only. Enable autonomousTrading + user toggle in Phase 6.',
        plannedAction: decision.action,
        wouldExecute: false,
        config: this.getConfig(),
      }
      this.bus.publish('tlm.autonomy.blocked', plan, 'AutonomousExecutionEngine')
      return plan
    }

    if (!isExecutionAllowed(flags)) {
      const plan: AutonomousPlan = {
        armed: false,
        blockedReason: 'realSwapExecution flagged OFF — no custody / no auto-send.',
        plannedAction: decision.action,
        wouldExecute: false,
        config: this.getConfig(),
      }
      this.bus.publish('tlm.autonomy.blocked', plan, 'AutonomousExecutionEngine')
      return plan
    }

    if (decision.scores.confidence < this.config.confidenceThreshold) {
      const plan: AutonomousPlan = {
        armed: true,
        blockedReason: `Confidence ${decision.scores.confidence}% below threshold ${this.config.confidenceThreshold}%`,
        plannedAction: decision.action,
        wouldExecute: false,
        config: this.getConfig(),
      }
      this.bus.publish('tlm.autonomy.blocked', plan, 'AutonomousExecutionEngine')
      return plan
    }

    if (!this.config.allowedChains.includes(decision.chain as AutonomyConfig['allowedChains'][number])) {
      const plan: AutonomousPlan = {
        armed: true,
        blockedReason: `Chain ${decision.chain} not in allowed set`,
        plannedAction: decision.action,
        wouldExecute: false,
        config: this.getConfig(),
      }
      this.bus.publish('tlm.autonomy.blocked', plan, 'AutonomousExecutionEngine')
      return plan
    }

    const plan: AutonomousPlan = {
      armed: true,
      blockedReason: this.config.requireConfirmation
        ? 'Would execute after user confirmation (bounded autonomy)'
        : null,
      plannedAction: decision.action,
      wouldExecute: !this.config.requireConfirmation && decision.action !== 'DO_NOTHING' && decision.action !== 'WAIT',
      config: this.getConfig(),
    }
    this.bus.publish('tlm.autonomy.planned', plan, 'AutonomousExecutionEngine')
    return plan
  }
}
