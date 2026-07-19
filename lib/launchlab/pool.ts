/**
 * Deterministic Launchpad pool PDA + status helpers (client-safe / test-safe).
 * No server-only — keep execution + risk gate in raydium.service.ts.
 */

import {
  LAUNCHPAD_PROGRAM as RDM_LAUNCHPAD_PROGRAM,
  DEV_LAUNCHPAD_PROGRAM as RDM_DEV_LAUNCHPAD_PROGRAM,
  getPdaLaunchpadPoolId as RDM_getPdaLaunchpadPoolId,
} from '@raydium-io/raydium-sdk-v2'
import { PublicKey } from '@solana/web3.js'
import { NATIVE_MINT } from '@solana/spl-token'

/** Raydium Launchpad PoolStatus (on-chain u8) — CPI `states.rs` / docs. */
export const LAUNCHPAD_POOL_STATUS = {
  FUND: 0,
  MIGRATE: 1,
  /** Migrated off curve — trade on AMM/CPMM via Jupiter. */
  TRADE: 2,
} as const

export type LaunchlabCluster = 'mainnet' | 'devnet'

export function resolveLaunchpadPoolId(
  mintAddress: PublicKey,
  cluster: LaunchlabCluster,
): PublicKey {
  const programId = cluster === 'mainnet' ? RDM_LAUNCHPAD_PROGRAM : RDM_DEV_LAUNCHPAD_PROGRAM
  return RDM_getPdaLaunchpadPoolId(programId, mintAddress, NATIVE_MINT).publicKey
}

export function isBondingCurveActive(status: number): boolean {
  return status === LAUNCHPAD_POOL_STATUS.FUND
}

export class LaunchpadMigratedError extends Error {
  constructor(readonly status: number) {
    super('Pool has migrated off the bonding curve — route through the Jupiter path instead')
    this.name = 'LaunchpadMigratedError'
  }
}
