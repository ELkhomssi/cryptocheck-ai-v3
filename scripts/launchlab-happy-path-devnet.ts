/**
 * Devnet LaunchLab full happy path (create → confirm → buy to graduate →
 * wait for migration → claim platform fees → sync DB lane).
 *
 * Usage:
 *   LAUNCHLAB_CLUSTER=devnet \
 *   LAUNCHLAB_PLATFORM_ID=... \
 *   LAUNCHLAB_PLATFORM_ADMIN_SECRET=[...] \
 *   TS_NODE_PROJECT=tsconfig.scripts.json \
 *   npx ts-node --transpile-only scripts/launchlab-happy-path-devnet.ts
 *
 * Prints PASS/FAIL lines with explorer links for each stage.
 */
import {
  DEVNET_PROGRAM_ID,
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
  sendAndConfirmTransaction,
  VersionedTransaction,
} from '@solana/web3.js'
import BN from 'bn.js'
import { initSdk } from '../lib/launch/raydium-sdk'
import {
  CREATOR_FEE_RATE,
  getPlatformId,
  getRpcUrl,
  PLATFORM_FEE_RATE,
} from '../lib/launch/config'
import { assertLaunchConfigValid, bootGuardOrThrow } from '../lib/launch/guards'

const SOL_TARGET = Number(process.env.LAUNCHLAB_HAPPY_PATH_SOL_TARGET ?? '0.35')
const EXPLORER = 'https://explorer.solana.com'

function explorerTx(sig: string): string {
  return `${EXPLORER}/tx/${sig}?cluster=devnet`
}

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

function verdict(ok: boolean, label: string, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label} — ${detail}`)
  return ok
}

async function sendVersioned(
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
  if ((process.env.LAUNCHLAB_CLUSTER ?? 'devnet').toLowerCase() !== 'devnet') {
    throw new Error('This script is DEVNET only')
  }

  const connection = new Connection(getRpcUrl(), 'confirmed')
  assertLaunchConfigValid()
  await bootGuardOrThrow(connection)

  const owner = loadAdmin()
  const platformId = getPlatformId()
  const programId = DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM
  const bal = await connection.getBalance(owner.publicKey)
  console.log(`[happy-path] admin=${owner.publicKey.toBase58()} bal=${bal / 1e9} SOL`)
  console.log(`[happy-path] platformId=${platformId.toBase58()} solTarget=${SOL_TARGET}`)

  if (bal < SOL_TARGET * 1e9 + 150_000_000) {
    verdict(
      false,
      'funding',
      `Need ~${SOL_TARGET + 0.15} SOL for create+buys; have ${bal / 1e9}. Fund via https://faucet.solana.com`,
    )
    process.exit(1)
  }
  verdict(true, 'funding', `${bal / 1e9} SOL available`)

  // --- Platform on-chain check ---
  const platAcct = await connection.getAccountInfo(platformId)
  if (!platAcct) {
    verdict(false, 'platform-config', 'account missing')
    process.exit(1)
  }
  const plat = PlatformConfig.decode(platAcct.data)
  const feeOk =
    plat.feeRate.eq(PLATFORM_FEE_RATE) && plat.creatorFeeRate.eq(CREATOR_FEE_RATE)
  verdict(
    feeOk,
    'platform-config',
    `feeRate=${plat.feeRate} creatorFeeRate=${plat.creatorFeeRate} claim=${plat.platformClaimFeeWallet.toBase58()}`,
  )

  const raydium = await initSdk({
    owner,
    rpcUrl: getRpcUrl(),
    cluster: 'devnet',
  })

  const configId = getPdaLaunchpadConfigId(programId, NATIVE_MINT, 0, 0).publicKey
  const configData = await connection.getAccountInfo(configId)
  if (!configData) throw new Error(`Launchpad config missing: ${configId.toBase58()}`)
  const configInfo = LaunchpadConfig.decode(configData.data)

  const mintPair = Keypair.generate()
  const mintA = mintPair.publicKey
  const { LaunchpadPoolInitParam } = require('@raydium-io/raydium-sdk-v2') as typeof import('@raydium-io/raydium-sdk-v2')
  const supply = LaunchpadPoolInitParam.supply.clone()
  const totalSellA = LaunchpadPoolInitParam.totalSellA.clone()
  const totalFundRaisingB = new BN(Math.floor(SOL_TARGET * 1e9))
  const name = 'HappyPath'
  const ticker = 'HPY'
  const uri = 'https://cryptocheckai.com/logo.png'

  console.log(`[happy-path] creating mint=${mintA.toBase58()}`)

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
      // mint + owner may both need to sign; SDK usually partial-signs mint
      const sig = await sendVersioned(connection, tx, [owner, mintPair])
      createSigs.push(sig)
    } else {
      tx.partialSign(mintPair)
      tx.partialSign(owner)
      const sig = await sendAndConfirmTransaction(connection, tx, [owner, mintPair], {
        commitment: 'confirmed',
      })
      createSigs.push(sig)
    }
  }

  const createSig = createSigs[createSigs.length - 1] ?? ''
  const poolId =
    (extInfo as { address?: { poolId?: PublicKey } })?.address?.poolId ??
    getPdaLaunchpadPoolId(programId, mintA, NATIVE_MINT).publicKey

  verdict(
    Boolean(createSig),
    'create',
    createSig ? explorerTx(createSig) : 'no signature',
  )
  console.log(`[happy-path] poolId=${poolId.toBase58()}`)

  // Verify platformId on pool
  const poolAcct = await connection.getAccountInfo(poolId)
  if (!poolAcct) {
    verdict(false, 'pool-platformId', 'pool account missing after create')
    process.exit(1)
  }
  const pool0 = LaunchpadPool.decode(poolAcct.data)
  verdict(
    pool0.platformId.equals(platformId),
    'pool-platformId',
    `on-chain=${pool0.platformId.toBase58()} expected=${platformId.toBase58()}`,
  )

  // --- Persist via confirm path (DB) when Next runtime available is optional;
  //     write evidence file for UI confirm replay. ---
  const evidence = {
    mint: mintA.toBase58(),
    poolId: poolId.toBase58(),
    platformId: platformId.toBase58(),
    createSignatures: createSigs,
    createTx: createSig,
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('fs').writeFileSync(
    '/tmp/launchlab-happy-path-evidence.json',
    JSON.stringify(evidence, null, 2),
  )

  // Try confirmLaunch if we can import (may need Next server-only stack)
  try {
    // Dynamic require to avoid hard fail when server-only deps missing in script
    const { confirmLaunch } = require('../lib/launch/confirm-launch') as typeof import('../lib/launch/confirm-launch')
    const rec = await confirmLaunch({
      mint: mintA.toBase58(),
      signature: createSig,
      creatorWallet: owner.publicKey.toBase58(),
      name,
      ticker,
      imageUrl: uri,
      supply: supply.toString(),
      totalSellA: totalSellA.toString(),
      totalFundRaisingB: totalFundRaisingB.toString(),
      solTarget: SOL_TARGET,
      curveType: 'custom',
      poolId: poolId.toBase58(),
    })
    verdict(
      true,
      'confirm+scan+db',
      `badge=${rec.badge ?? 'null'} migration=${rec.migrationStatus} mint=${rec.mint}`,
    )
  } catch (e) {
    verdict(
      false,
      'confirm+scan+db',
      e instanceof Error ? e.message : String(e),
    )
    console.log(
      '[happy-path] continue trades — you can POST /api/launch/confirm with evidence file',
    )
  }

  // --- Buy until graduation threshold ---
  const buySigs: string[] = []
  const chunk = new BN(Math.floor(0.08 * 1e9)) // 0.08 SOL chunks
  for (let i = 0; i < 12; i++) {
    const fresh = await connection.getAccountInfo(poolId)
    if (!fresh) break
    const pool = LaunchpadPool.decode(fresh.data)
    const status = Number(pool.status)
    const raised = pool.realB ?? pool.fundRaisingB ?? new BN(0)
    console.log(
      `[happy-path] buy loop i=${i} status=${status} realB=${raised.toString()} target=${pool.totalFundRaisingB.toString()}`,
    )
    if (status >= 1) break

    const remaining = pool.totalFundRaisingB.sub(raised)
    if (remaining.lte(new BN(0))) break
    const buyAmount = BN.min(chunk, remaining.add(new BN(20_000_000))) // small overshoot

    const { execute } = await raydium.launchpad.buyToken({
      programId,
      mintA,
      buyAmount,
      slippage: new BN(1000), // 10%
      txVersion: TxVersion.V0,
    })
    const sent = await execute({ sendAndConfirm: true })
    const sig =
      typeof sent === 'string' ? sent : ((sent as { txId?: string }).txId ?? String(sent))
    buySigs.push(sig)
    verdict(true, `curve-buy-${i + 1}`, explorerTx(sig))
    await new Promise((r) => setTimeout(r, 1500))
  }

  if (!buySigs.length) {
    verdict(false, 'curve-buys', 'no buy transactions landed')
  } else {
    verdict(true, 'curve-buys', `${buySigs.length} buys — last ${explorerTx(buySigs[buySigs.length - 1]!)}`)
  }

  // --- Wait for migrated status (Raydium crank) ---
  let migrateSig: string | null = null
  let finalStatus = 0
  for (let t = 0; t < 40; t++) {
    const fresh = await connection.getAccountInfo(poolId)
    if (!fresh) break
    const pool = LaunchpadPool.decode(fresh.data)
    finalStatus = Number(pool.status)
    console.log(`[happy-path] wait migrate t=${t} status=${finalStatus}`)
    if (finalStatus >= 2) {
      const sigs = await connection.getSignaturesForAddress(poolId, { limit: 20 })
      migrateSig = sigs.find((s) => !s.err)?.signature ?? null
      // Prefer a newer sig than the last buy
      for (const s of sigs) {
        if (s.err) continue
        if (!buySigs.includes(s.signature) && s.signature !== createSig) {
          migrateSig = s.signature
          break
        }
      }
      break
    }
    await new Promise((r) => setTimeout(r, 3000))
  }

  verdict(
    finalStatus >= 2,
    'migration',
    finalStatus >= 2
      ? `status=Migrated tx=${migrateSig ? explorerTx(migrateSig) : '(signature not isolated)'}`
      : `status still ${finalStatus} after wait — Raydium crank may be delayed ondevnet`,
  )

  // --- Claim platform fees (post-migrate: vault path; pre-migrate: pool path) ---
  try {
    const before = await connection.getBalance(owner.publicKey)
    let claimSig = ''
    if (finalStatus >= 2) {
      const { execute } = await raydium.launchpad.claimVaultPlatformFee({
        programId,
        platformId,
        mintB: NATIVE_MINT,
        claimFeeWallet: owner.publicKey,
        txVersion: TxVersion.V0,
      })
      const sent = await execute({ sendAndConfirm: true })
      claimSig =
        typeof sent === 'string'
          ? sent
          : ((sent as { txId?: string }).txId ?? String(sent))
    } else {
      const { execute } = await raydium.launchpad.claimPlatformFee({
        programId,
        platformId,
        poolId,
        platformClaimFeeWallet: owner.publicKey,
        txVersion: TxVersion.V0,
      })
      const sent = await execute({ sendAndConfirm: true })
      claimSig =
        typeof sent === 'string'
          ? sent
          : ((sent as { txId?: string }).txId ?? String(sent))
    }
    const after = await connection.getBalance(owner.publicKey)
    verdict(
      Boolean(claimSig) && !claimSig.includes('object'),
      'fee-claim',
      `${explorerTx(claimSig)} balΔ_lamports=${after - before}`,
    )
  } catch (e) {
    const detail =
      e && typeof e === 'object' && 'txId' in e
        ? `tx=${explorerTx(String((e as { txId: string }).txId))} err=${JSON.stringify(e)}`
        : e instanceof Error
          ? e.message
          : JSON.stringify(e)
    verdict(false, 'fee-claim', detail)
  }

  // --- DB lane sync ---
  try {
    const { syncLaunchMigrations } = require('../lib/launch/migration-sync') as typeof import('../lib/launch/migration-sync')
    const sync = await syncLaunchMigrations(20)
    const hit = sync.results.find((r) => r.mint === mintA.toBase58())
    verdict(
      Boolean(hit && hit.to === 'migrated'),
      'migration-listener',
      hit
        ? `${hit.from}→${hit.to} migrationTx=${hit.migrationTx ?? 'null'}`
        : `checked=${sync.checked} updated=${sync.updated} (mint may be missing if confirm failed)`,
    )
  } catch (e) {
    verdict(false, 'migration-listener', e instanceof Error ? e.message : String(e))
  }

  console.log('\n=== EVIDENCE SUMMARY ===')
  console.log(JSON.stringify({ createSigs, buySigs, migrateSig, mint: mintA.toBase58(), poolId: poolId.toBase58() }, null, 2))
}

main().catch((e) => {
  console.error('[happy-path] fatal:', e)
  process.exit(1)
})
