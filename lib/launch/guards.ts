import {
  DEVNET_PROGRAM_ID,
  getPdaPlatformId,
  LAUNCHPAD_PROGRAM,
  PlatformConfig,
} from '@raydium-io/raydium-sdk-v2'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import {
  CREATOR_FEE_RATE,
  getCpConfigId,
  getPlatformId,
  launchCluster,
  PLATFORM_FEE_RATE,
} from './config'

/**
 * Sync env sanity — catches swapped PLATFORM_ID / CP_CONFIG / wallet address
 * before any RPC create call.
 */
export function assertLaunchConfigValid(): void {
  const cluster = launchCluster()
  const platformId = getPlatformId()
  const cpConfigId = getCpConfigId()

  if (platformId.equals(cpConfigId)) {
    throw new Error(
      `LAUNCHLAB_PLATFORM_ID equals LAUNCHLAB_CP_CONFIG_ID (${platformId.toBase58()}) — values are swapped or duplicated`,
    )
  }

  const admin = tryLoadAdminPubkey()
  if (admin && platformId.equals(admin)) {
    throw new Error(
      `LAUNCHLAB_PLATFORM_ID is set to the admin wallet pubkey (${platformId.toBase58()}) — expected PlatformConfig PDA, not wallet`,
    )
  }

  if (admin) {
    const programId =
      cluster === 'devnet' ? DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM : LAUNCHPAD_PROGRAM
    const expected = getPdaPlatformId(programId, admin).publicKey
    if (!platformId.equals(expected)) {
      // Soft when platform was created under a different admin (legacydevnet) —
      // hard fail is enforced in assertPlatformConfigValid via on-chain decode + cp match.
      console.warn(
        `[launch-guard] PLATFORM_ID ${platformId.toBase58()} != PDA for current admin ${admin.toBase58()} (expected ${expected.toBase58()})`,
      )
    }
  }

  console.log(
    `[launch-guard] assertLaunchConfigValid OK cluster=${cluster} platform=${platformId.toBase58()} cp=${cpConfigId.toBase58()}`,
  )
}

/**
 * On-chain PlatformConfig decode + fee/cp identity checks.
 * Logs: OK — Platform Config verified
 */
export async function assertPlatformConfigValid(connection: Connection): Promise<void> {
  const platformId = getPlatformId()
  const expectedCp = getCpConfigId()
  const acct = await connection.getAccountInfo(platformId)

  if (!acct) {
    throw new Error(
      `Platform Config account not found for LAUNCHLAB_PLATFORM_ID=${platformId.toBase58()} on ${launchCluster()}`,
    )
  }
  if (acct.data.length === 0) {
    throw new Error(
      `LAUNCHLAB_PLATFORM_ID=${platformId.toBase58()} has empty account data (looks like a wallet, not PlatformConfig PDA)`,
    )
  }

  let cfg: ReturnType<typeof PlatformConfig.decode>
  try {
    cfg = PlatformConfig.decode(acct.data)
  } catch (e) {
    throw new Error(
      `Failed to decode PlatformConfig at ${platformId.toBase58()}: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  if (!cfg.cpConfigId.equals(expectedCp)) {
    throw new Error(
      `cpConfigId mismatch: on-chain ${cfg.cpConfigId.toBase58()} != env ${expectedCp.toBase58()}`,
    )
  }
  if (!cfg.feeRate.eq(PLATFORM_FEE_RATE)) {
    throw new Error(`feeRate mismatch: on-chain ${cfg.feeRate.toString()} != ${PLATFORM_FEE_RATE.toString()}`)
  }
  if (!cfg.creatorFeeRate.eq(CREATOR_FEE_RATE)) {
    throw new Error(
      `creatorFeeRate mismatch: on-chain ${cfg.creatorFeeRate.toString()} != ${CREATOR_FEE_RATE.toString()}`,
    )
  }

  console.log('OK — Platform Config verified')
}

/** Boot: env assert + on-chain verify. Throws on failure. */
export async function bootGuardOrThrow(connection: Connection): Promise<void> {
  assertLaunchConfigValid()
  await assertPlatformConfigValid(connection)
}

function tryLoadAdminPubkey(): PublicKey | null {
  const raw = process.env.LAUNCHLAB_PLATFORM_ADMIN_SECRET?.trim()
  if (!raw) {
    const explicit = process.env.LAUNCHLAB_PLATFORM_ADMIN_PUBKEY?.trim()
    return explicit ? new PublicKey(explicit) : null
  }
  try {
    if (raw.startsWith('[')) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[])).publicKey
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bs58 = require('bs58') as { decode: (s: string) => Uint8Array }
    return Keypair.fromSecretKey(bs58.decode(raw)).publicKey
  } catch {
    return null
  }
}
