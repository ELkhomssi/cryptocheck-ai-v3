import type { LiquidityMigratePlan, LiquidityProvider } from './provider'

/**
 * Production liquidity path: Raydium LaunchLab bonding curve → CPMM migrate.
 * createLaunchpad uses migrateType: 'cpmm' — graduation is owned by Raydium,
 * we observe status via migration-sync (lazy import — keeps unit tests free of server-only).
 */
export class RaydiumCpmmLiquidityProvider implements LiquidityProvider {
  readonly id = 'raydium-cpmm' as const
  readonly label = 'Raydium CPMM'

  isAvailable(): boolean {
    return true
  }

  async planMigration(input: { mint: string; poolId: string }): Promise<LiquidityMigratePlan> {
    const { readPoolMigrationStatus } = await import('../migration-sync')
    const onchain = await readPoolMigrationStatus(input.mint, input.poolId || null)
    if (!onchain) {
      return {
        provider: this.id,
        mint: input.mint,
        poolId: input.poolId,
        status: 'curve',
        note: 'Pool status unavailable — treating as bonding-curve phase.',
      }
    }
    const status =
      onchain.lane === 'migrated'
        ? 'migrated'
        : onchain.lane === 'migrate'
          ? 'migrate_ready'
          : 'curve'
    return {
      provider: this.id,
      mint: input.mint,
      poolId: onchain.poolId || input.poolId,
      status,
      note:
        status === 'migrated'
          ? 'Graduated to Raydium CPMM. Trade via Jupiter / Launchpad swap.'
          : status === 'migrate_ready'
            ? 'Curve target reached — Raydium migration in progress.'
            : 'Trading on Raydium LaunchLab bonding curve until SOL target is met.',
    }
  }
}
