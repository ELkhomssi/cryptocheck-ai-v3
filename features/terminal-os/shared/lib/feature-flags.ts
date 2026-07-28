/**
 * Feature flags for Terminal OS.
 * Autonomous / real-money paths stay OFF until Phase 6.
 */

import type { AutonomyPermissionTier, FeatureFlags } from '../types'

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  autonomousTrading: false,
  copyTrading: false,
  realSwapExecution: false,
}

/** Default permission when autonomous trading is eventually enabled */
export const DEFAULT_AUTONOMY_TIER: AutonomyPermissionTier = 'advise_only'

export function isExecutionAllowed(flags: FeatureFlags): boolean {
  return flags.realSwapExecution === true
}

export function isAutonomousAllowed(flags: FeatureFlags): boolean {
  return flags.autonomousTrading === true
}
