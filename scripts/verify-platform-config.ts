/**
 * Fix verify-platform-config.ts with correct PlatformConfig layout fields.
 *
 *   LAUNCHLAB_CLUSTER=devnet LAUNCHLAB_PLATFORM_ID=... npx ts-node --transpile-only scripts/verify-platform-config.ts
 */
import { PlatformConfig, getPdaPlatformId, DEVNET_PROGRAM_ID, LAUNCHPAD_PROGRAM } from '@raydium-io/raydium-sdk-v2'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import {
  CREATOR_FEE_RATE,
  getPlatformId,
  getRpcUrl,
  launchCluster,
  PLATFORM_FEE_RATE,
} from '../lib/launch/config'

function loadAdminPubkey(): PublicKey {
  const raw = process.env.LAUNCHLAB_PLATFORM_ADMIN_SECRET?.trim()
  if (raw?.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[])).publicKey
  }
  const explicit = process.env.LAUNCHLAB_PLATFORM_ADMIN_PUBKEY?.trim()
  if (explicit) return new PublicKey(explicit)
  throw new Error('Set LAUNCHLAB_PLATFORM_ADMIN_SECRET or LAUNCHLAB_PLATFORM_ADMIN_PUBKEY')
}

function decodeStr(arr: number[] | Uint8Array): string {
  return Buffer.from(arr).toString('utf8').replace(/\0+$/g, '')
}

async function main() {
  const platformId = getPlatformId()
  const admin = loadAdminPubkey()
  const programId =
    launchCluster() === 'devnet' ? DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM : LAUNCHPAD_PROGRAM
  const expectedPda = getPdaPlatformId(programId, admin).publicKey
  const connection = new Connection(getRpcUrl(), 'confirmed')
  const acct = await connection.getAccountInfo(platformId)
  if (!acct) {
    console.error('FAIL: PlatformConfig account not found:', platformId.toBase58())
    process.exit(1)
  }

  const cfg = PlatformConfig.decode(acct.data)
  const expectedCp = process.env.LAUNCHLAB_CP_CONFIG_ID?.trim()
  const row = {
    platformId: platformId.toBase58(),
    matchesAdminPda: platformId.equals(expectedPda),
    platformClaimFeeWallet: cfg.platformClaimFeeWallet.toBase58(),
    platformLockNftWallet: cfg.platformLockNftWallet.toBase58(),
    platformVestingWallet: cfg.platformVestingWallet.toBase58(),
    cpConfigId: cfg.cpConfigId.toBase58(),
    feeRate: cfg.feeRate.toString(),
    creatorFeeRate: cfg.creatorFeeRate.toString(),
    platformScale: cfg.platformScale.toString(),
    creatorScale: cfg.creatorScale.toString(),
    burnScale: cfg.burnScale.toString(),
    name: decodeStr(cfg.name),
    web: decodeStr(cfg.web),
    img: decodeStr(cfg.img),
    lamports: acct.lamports,
    owner: acct.owner.toBase58(),
  }
  console.log(JSON.stringify(row, null, 2))

  const fails: string[] = []
  if (!platformId.equals(expectedPda)) fails.push('platformId PDA mismatch')
  if (!cfg.feeRate.eq(PLATFORM_FEE_RATE)) fails.push(`feeRate ${cfg.feeRate} != ${PLATFORM_FEE_RATE}`)
  if (!cfg.creatorFeeRate.eq(CREATOR_FEE_RATE)) {
    fails.push(`creatorFeeRate ${cfg.creatorFeeRate} != ${CREATOR_FEE_RATE}`)
  }
  if (expectedCp && cfg.cpConfigId.toBase58() !== expectedCp) {
    fails.push(`cpConfigId mismatch`)
  }
  if (fails.length) {
    console.error('FAIL:', fails.join('; '))
    process.exit(1)
  }
  console.log('PASS: PlatformConfig fee/admin fields match intended values.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
