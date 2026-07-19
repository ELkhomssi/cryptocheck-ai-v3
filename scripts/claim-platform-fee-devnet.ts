/**
 * Claim platform fees for a known pool/mint ondevnet.
 * Usage: LAUNCHLAB_* env + CLAIM_POOL_ID=... CLAIM_MINT=... npx ts-node --transpile-only scripts/claim-platform-fee-devnet.ts
 */
import { DEVNET_PROGRAM_ID, LaunchpadPool, TxVersion } from '@raydium-io/raydium-sdk-v2'
import { Keypair, PublicKey, Connection } from '@solana/web3.js'
import { initSdk } from '../lib/launch/raydium-sdk'
import { getPlatformId, getRpcUrl } from '../lib/launch/config'

function loadAdmin(): Keypair {
  const raw = process.env.LAUNCHLAB_PLATFORM_ADMIN_SECRET!.trim()
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]))
}

async function main() {
  const owner = loadAdmin()
  const platformId = getPlatformId()
  const poolId = new PublicKey(process.env.CLAIM_POOL_ID!)
  const connection = new Connection(getRpcUrl(), 'confirmed')
  const poolAcct = await connection.getAccountInfo(poolId)
  if (!poolAcct) throw new Error('pool missing')
  const pool = LaunchpadPool.decode(poolAcct.data)
  console.log({
    status: pool.status,
    platformFee: pool.platformFee.toString(),
    realB: pool.realB.toString(),
  })

  const raydium = await initSdk({ owner, rpcUrl: getRpcUrl(), cluster: 'devnet' })

  try {
    const { execute } = await raydium.launchpad.claimPlatformFee({
      programId: DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM,
      platformId,
      poolId,
      platformClaimFeeWallet: owner.publicKey,
      txVersion: TxVersion.V0,
    })
    const sent = await execute({ sendAndConfirm: true })
    console.log('PASS: claimPlatformFee', sent)
  } catch (e: unknown) {
    console.log('FAIL: claimPlatformFee raw=', e)
    console.log('msg=', e instanceof Error ? e.message : String(e))
    if (e && typeof e === 'object') console.dir(e, { depth: 5 })
  }

  const proto = Object.getPrototypeOf(raydium.launchpad)
  console.log(
    'claim methods',
    Object.getOwnPropertyNames(proto).filter((n) => /claim/i.test(n)),
  )

  for (const method of ['claimVaultPlatformFee', 'claimAllPlatformFee'] as const) {
    const fn = (raydium.launchpad as Record<string, unknown>)[method]
    if (typeof fn !== 'function') continue
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { execute } = await (fn as any).call(raydium.launchpad, {
        programId: DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM,
        platformId,
        mintB: pool.mintB,
        claimFeeWallet: owner.publicKey,
        platformClaimFeeWallet: owner.publicKey,
        txVersion: TxVersion.V0,
      })
      const sent = await execute({ sendAndConfirm: true })
      console.log(`PASS: ${method}`, sent)
    } catch (e: unknown) {
      console.log(`FAIL: ${method}`, e instanceof Error ? e.message : e)
      console.dir(e, { depth: 4 })
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
