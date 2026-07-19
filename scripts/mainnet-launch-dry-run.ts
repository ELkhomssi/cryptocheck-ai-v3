/**
 * MAINNET_LAUNCH_DRY_RUN — create + tiny curve buys only (no graduation).
 * Uses the same Raydium LaunchLab path as /api/launch/prepare (live Platform Config).
 *
 * Scope locked: create_and_buy_only — defer MigrateToCpswap until funded for ≥24 SOL raise.
 *
 * Usage:
 *   TS_NODE_PROJECT=tsconfig.scripts.json npx ts-node --transpile-only scripts/mainnet-launch-dry-run.ts
 */
import {
  LAUNCHPAD_PROGRAM,
  getPdaLaunchpadConfigId,
  getPdaLaunchpadPoolId,
  LaunchpadConfig,
  LaunchpadPool,
  PlatformConfig,
  TxVersion,
} from '@raydium-io/raydium-sdk-v2'
import { NATIVE_MINT } from '@solana/spl-token'
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import BN from 'bn.js'
import { initSdk } from '../lib/launch/raydium-sdk'
import { getPlatformId, getRpcUrl } from '../lib/launch/config'

const EXPECTED_WALLET = '5jbWsijUWqXLyuaNtzkiu2JM1C5jNPUP9oRjKmmJx15i'
/** App floor is 30 SOL raise target — creation does not require holding 30 SOL. */
const SOL_TARGET = 30
/** Tiny post-create buy — keep small given dry-run wallet balance. */
const BUY_SOL = Number(process.env.LAUNCH_DRY_RUN_BUY_SOL ?? '0.005')

function loadAdmin(): Keypair {
  const raw = process.env.LAUNCHLAB_PLATFORM_ADMIN_SECRET?.trim()
  if (!raw) throw new Error('LAUNCHLAB_PLATFORM_ADMIN_SECRET required')
  if (raw.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]))
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bs58 = require('bs58') as { decode: (s: string) => Uint8Array }
  return Keypair.fromSecretKey(bs58.decode(raw))
}

function explorer(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}`
}

function pass(ok: boolean, label: string, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label} — ${detail}`)
  return ok
}

async function sendVtx(
  connection: Connection,
  tx: VersionedTransaction,
  signers: Keypair[],
): Promise<string> {
  tx.sign(signers)
  const sig = await connection.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 })
  const latest = await connection.getLatestBlockhash('confirmed')
  await connection.confirmTransaction({ signature: sig, ...latest }, 'confirmed')
  return sig
}

async function main() {
  if ((process.env.LAUNCHLAB_CLUSTER ?? '').toLowerCase() !== 'mainnet-beta' &&
      (process.env.LAUNCHLAB_CLUSTER ?? '').toLowerCase() !== 'mainnet') {
    throw new Error('Set LAUNCHLAB_CLUSTER=mainnet-beta for MAINNET_LAUNCH_DRY_RUN')
  }

  const owner = loadAdmin()
  if (owner.publicKey.toBase58() !== EXPECTED_WALLET) {
    throw new Error(`Admin pubkey ${owner.publicKey.toBase58()} !== ${EXPECTED_WALLET}`)
  }

  const platformId = getPlatformId()
  const connection = new Connection(getRpcUrl(), 'confirmed')
  const bal = await connection.getBalance(owner.publicKey)
  console.log(`[dry-run] wallet=${owner.publicKey.toBase58()} bal=${bal / 1e9} SOL`)
  console.log(`[dry-run] platformId=${platformId.toBase58()}`)
  console.log(`[dry-run] scope=create_and_buy_only buySol=${BUY_SOL}`)

  if (bal < 25_000_000) {
    pass(false, 'funding', `${bal / 1e9} SOL — need ≥0.025 SOL for create rent; fund wallet then retry`)
    process.exit(1)
  }
  pass(true, 'funding', `${bal / 1e9} SOL available`)

  const platAcct = await connection.getAccountInfo(platformId)
  if (!platAcct) {
    pass(false, 'platform-config', 'Platform PDA missing on mainnet')
    process.exit(1)
  }
  const plat = PlatformConfig.decode(platAcct.data)
  pass(
    true,
    'platform-config',
    `feeRate=${plat.feeRate} creatorFeeRate=${plat.creatorFeeRate} claim=${plat.platformClaimFeeWallet.toBase58()}`,
  )

  const raydium = await initSdk({
    owner,
    rpcUrl: getRpcUrl(),
    cluster: 'mainnet',
  })

  const programId = LAUNCHPAD_PROGRAM
  const configId = getPdaLaunchpadConfigId(programId, NATIVE_MINT, 0, 0).publicKey
  const configData = await connection.getAccountInfo(configId)
  if (!configData) throw new Error(`Launchpad config missing: ${configId.toBase58()}`)
  const configInfo = LaunchpadConfig.decode(configData.data)

  const { LaunchpadPoolInitParam } = await import('@raydium-io/raydium-sdk-v2')
  const mintPair = Keypair.generate()
  const mintA = mintPair.publicKey
  const supply = LaunchpadPoolInitParam.supply.clone()
  const totalSellA = LaunchpadPoolInitParam.totalSellA.clone()
  const totalFundRaisingB = new BN(Math.floor(SOL_TARGET * 1e9))

  const name = 'CCDryRun'
  const ticker = 'CCDR'
  const uri = 'https://cryptocheckai.com/logo.png'

  console.log(`[dry-run] creating mint=${mintA.toBase58()}`)

  const { transactions, extInfo } = await raydium.launchpad.createLaunchpad({
    programId,
    mintA,
    decimals: 6,
    name,
    symbol: ticker,
    uri,
    migrateType: 'cpmm',
    configId,
    configInfo,
    platformId,
    supply,
    totalSellA,
    totalFundRaisingB,
    totalLockedAmount: new BN(0),
    cliffPeriod: new BN(0),
    unlockPeriod: new BN(0),
    txVersion: TxVersion.V0,
    buyAmount: new BN(0),
    createOnly: true,
    extraSigners: [mintPair],
    feePayer: owner.publicKey,
  })

  const createSigs: string[] = []
  for (const tx of transactions ?? []) {
    if (tx instanceof VersionedTransaction) {
      createSigs.push(await sendVtx(connection, tx, [owner, mintPair]))
    } else {
      tx.partialSign(mintPair)
      tx.partialSign(owner)
      createSigs.push(
        await sendAndConfirmTransaction(connection, tx, [owner, mintPair], {
          commitment: 'confirmed',
        }),
      )
    }
  }
  const createSig = createSigs[createSigs.length - 1]!
  const poolId =
    (extInfo as { address?: { poolId?: PublicKey } })?.address?.poolId ??
    getPdaLaunchpadPoolId(programId, mintA, NATIVE_MINT).publicKey

  pass(true, 'create', explorer(createSig))
  console.log(`[dry-run] poolId=${poolId.toBase58()}`)

  const poolAcct = await connection.getAccountInfo(poolId)
  if (!poolAcct) {
    pass(false, 'pool-platformId', 'pool missing')
    process.exit(1)
  }
  const pool = LaunchpadPool.decode(poolAcct.data)
  pass(
    pool.platformId.equals(platformId),
    'pool-platformId',
    `on-chain=${pool.platformId.toBase58()}`,
  )

  // Tiny curve buy(s)
  const buySigs: string[] = []
  const buyLamports = new BN(Math.floor(BUY_SOL * 1e9))
  const balAfterCreate = await connection.getBalance(owner.publicKey)
  if (balAfterCreate < buyLamports.toNumber() + 8_000_000) {
    pass(
      false,
      'curve-buy',
      `insufficient after create (${balAfterCreate / 1e9} SOL) for ${BUY_SOL} SOL buy — create evidence still valid`,
    )
  } else {
    for (let i = 0; i < 2; i++) {
      const amount = i === 0 ? buyLamports : buyLamports.divn(2)
      if (amount.ltn(1_000_000)) break
      const left = await connection.getBalance(owner.publicKey)
      if (left < amount.toNumber() + 5_000_000) break
      try {
        const { execute } = await raydium.launchpad.buyToken({
          programId,
          mintA,
          buyAmount: amount,
          slippage: new BN(1500),
          txVersion: TxVersion.V0,
        })
        const sent = await execute({ sendAndConfirm: true })
        const sig =
          typeof sent === 'string' ? sent : ((sent as { txId?: string }).txId ?? String(sent))
        buySigs.push(sig)
        pass(true, `curve-buy-${i + 1}`, explorer(sig))
      } catch (e) {
        pass(false, `curve-buy-${i + 1}`, e instanceof Error ? e.message : JSON.stringify(e))
        break
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('fs').writeFileSync(
    '/tmp/mainnet-launch-dry-run.json',
    JSON.stringify(
      {
        mint: mintA.toBase58(),
        poolId: poolId.toBase58(),
        platformId: platformId.toBase58(),
        createSig,
        createSigs,
        buySigs,
        note: 'graduation deferred — mainnet min raise 24 SOL',
      },
      null,
      2,
    ),
  )

  console.log('\n=== MAINNET_LAUNCH_DRY_RUN EVIDENCE ===')
  console.log(
    JSON.stringify(
      { mint: mintA.toBase58(), poolId: poolId.toBase58(), createSig, buySigs },
      null,
      2,
    ),
  )
  console.log(
    '\nNext: POST /api/launch/confirm with mint+createSig for Neural V4 badge (server must be on mainnet cluster).',
  )
}

main().catch((e) => {
  console.error('[dry-run] fatal:', e)
  process.exit(1)
})
