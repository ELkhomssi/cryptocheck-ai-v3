/**
 * One-time operator script: register CryptoCheck Platform PDA on Raydium LaunchLab.
 *
 * Usage (devnet first):
 *   LAUNCHLAB_CLUSTER=devnet \
 *   LAUNCHLAB_PLATFORM_ADMIN_SECRET=<base58 or JSON byte array> \
 *   LAUNCHLAB_CP_CONFIG_ID=<cpmm config from Raydium API> \
 *   TS_NODE_PROJECT=tsconfig.scripts.json npx ts-node scripts/create-platform.ts
 *
 * Then set LAUNCHLAB_PLATFORM_ID in .env.local to the printed platformId.
 *
 * Every wallet may create only ONE platform config on LaunchLab.
 * Before mainnet: get crypto-legal review — branded launchpads facilitating token
 * sales are a regulatory surface. Run the full flow on DEVNET until Task 5 is green.
 */
import {
  DEVNET_PROGRAM_ID,
  LAUNCHPAD_PROGRAM,
  TxVersion,
} from '@raydium-io/raydium-sdk-v2'
import { Keypair, PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { initSdk } from '../lib/launch/raydium-sdk'
import {
  CREATOR_FEE_RATE,
  getRpcUrl,
  launchCluster,
  PLATFORM_FEE_RATE,
} from '../lib/launch/config'

/**
 * Sole business wallet for platformAdmin + claim (and related LaunchLab wallets).
 * PDA is derived from platformAdmin — LAUNCHLAB_PLATFORM_ADMIN_SECRET MUST be this key.
 * Do not hardcode any other pubkeys in this script.
 */
const PLATFORM_BUSINESS_WALLET = new PublicKey(
  '5jbWsijUWqXLyuaNtzkiu2JM1C5jNPUP9oRjKmmJx15i',
)

function loadAdminKeypair(): Keypair {
  const raw = process.env.LAUNCHLAB_PLATFORM_ADMIN_SECRET?.trim()
  if (!raw) {
    throw new Error('Set LAUNCHLAB_PLATFORM_ADMIN_SECRET (base58 secret or JSON uint8 array)')
  }
  if (raw.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]))
  }
  // Lazy require so the script still typechecks if bs58 is transitive-only
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bs58 = require('bs58') as { decode: (s: string) => Uint8Array }
  return Keypair.fromSecretKey(bs58.decode(raw))
}

async function main() {
  const cluster = launchCluster()
  const owner = loadAdminKeypair()
  if (!owner.publicKey.equals(PLATFORM_BUSINESS_WALLET)) {
    throw new Error(
      `LAUNCHLAB_PLATFORM_ADMIN_SECRET pubkey is ${owner.publicKey.toBase58()}, ` +
        `expected PLATFORM_BUSINESS_WALLET ${PLATFORM_BUSINESS_WALLET.toBase58()}`,
    )
  }

  const programId =
    cluster === 'devnet' ? DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM : LAUNCHPAD_PROGRAM

  const cpConfigRaw = process.env.LAUNCHLAB_CP_CONFIG_ID?.trim()
  if (!cpConfigRaw) {
    throw new Error(
      'Set LAUNCHLAB_CP_CONFIG_ID — fetch from https://api-v3.raydium.io/main/cpmm-config (or api-v3-devnet for devnet)',
    )
  }
  const cpConfigId = new PublicKey(cpConfigRaw)

  const raydium = await initSdk({
    owner,
    rpcUrl: getRpcUrl(),
    cluster,
  })

  console.log(`[create-platform] cluster=${cluster} program=${programId.toBase58()}`)
  console.log(`[create-platform] platformAdmin/claimWallet=${PLATFORM_BUSINESS_WALLET.toBase58()}`)

  console.log('[create-platform] fee decision (denom 1e6):', {
    platformFeeRate: PLATFORM_FEE_RATE.toString(),
    platformFeePct: `${(PLATFORM_FEE_RATE.toNumber() / 1e4).toFixed(2)}%`,
    creatorFeeRate: CREATOR_FEE_RATE.toString(),
    creatorFeePct: `${(CREATOR_FEE_RATE.toNumber() / 1e4).toFixed(2)}%`,
    migrateLpNft: 'platform 40% / creator 50% / burn 10%',
  })

  const { execute, extInfo } = await raydium.launchpad.createPlatformConfig({
    programId,
    platformAdmin: PLATFORM_BUSINESS_WALLET,
    platformClaimFeeWallet: PLATFORM_BUSINESS_WALLET,
    platformLockNftWallet: PLATFORM_BUSINESS_WALLET,
    platformVestingWallet: PLATFORM_BUSINESS_WALLET,
    cpConfigId,
    transferFeeExtensionAuth: PLATFORM_BUSINESS_WALLET,
    creatorFeeRate: CREATOR_FEE_RATE,
    feeRate: PLATFORM_FEE_RATE,
    migrateCpLockNftScale: {
      platformScale: new BN(400_000),
      creatorScale: new BN(500_000),
      burnScale: new BN(100_000),
    },
    name: 'CryptoCheck',
    web: 'https://cryptocheckai.com',
    img: 'https://cryptocheckai.com/logo.png',
    txVersion: TxVersion.V0,
  })

  const sent = await execute({ sendAndConfirm: true })
  const platformId = extInfo.platformId.toBase58()
  const txSig =
    typeof sent === 'string'
      ? sent
      : (sent as { txId?: string }).txId ?? JSON.stringify(sent)

  console.log('[create-platform] tx:', txSig)
  console.log(
    `[create-platform] explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`,
  )
  console.log('')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  LAUNCHLAB_PLATFORM_ID=${platformId}`)
  console.log('  Add this to .env.local / deploy secrets.')
  console.log('═══════════════════════════════════════════════════════════')
}

main().catch((e) => {
  console.error('[create-platform] failed:', e)
  process.exit(1)
})
