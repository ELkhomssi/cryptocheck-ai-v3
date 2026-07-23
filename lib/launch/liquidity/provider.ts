/**
 * Liquidity provider abstraction for LaunchLab graduation / AMM attachment.
 * Raydium CPMM migrate is the current production path; Meteora / Orca / PumpSwap
 * can be added as adapters without changing the create wizard.
 */

export type LiquidityProviderId = 'raydium-cpmm' | 'meteora' | 'orca' | 'pumpswap'

export type LiquidityMigratePlan = {
  provider: LiquidityProviderId
  mint: string
  poolId: string
  /** Human-readable status for ops / UI. */
  status: 'curve' | 'migrate_ready' | 'migrating' | 'migrated' | 'unsupported'
  note: string
}

export type LiquidityProvider = {
  readonly id: LiquidityProviderId
  readonly label: string
  /** Whether this provider is wired for production use on the current cluster. */
  isAvailable(): boolean
  /** Describe how a LaunchLab pool attaches liquidity after graduation. */
  planMigration(input: { mint: string; poolId: string }): Promise<LiquidityMigratePlan>
}

export class UnsupportedLiquidityProvider implements LiquidityProvider {
  constructor(
    readonly id: LiquidityProviderId,
    readonly label: string,
  ) {}

  isAvailable(): boolean {
    return false
  }

  async planMigration(input: { mint: string; poolId: string }): Promise<LiquidityMigratePlan> {
    return {
      provider: this.id,
      mint: input.mint,
      poolId: input.poolId,
      status: 'unsupported',
      note: `${this.label} integration is reserved — not enabled in this deployment.`,
    }
  }
}
