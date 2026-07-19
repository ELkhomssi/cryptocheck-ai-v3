/**
 * One-off tiny buy against the MAINNET_LAUNCH_DRY_RUN mint.
 * Usage: TS_NODE_PROJECT=tsconfig.scripts.json npx ts-node --transpile-only scripts/mainnet-tiny-buy.ts
 */
import { LAUNCHPAD_PROGRAM, LaunchpadPool, TxVersion } from '@raydium-io/raydium-sdk-v2'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import { getRpcUrl } from '../lib/launch/config'
import { initSdk } from '../lib/launch/raydium-sdk'

const MINT = process.env.DRY_RUN_MINT || '9w88MYqpxawUQ7GJSHFx2xk8gAgBcux75kqGVPQfUiBH'
const POOL = process.env.DRY_RUN_POOL || 'EQAqCSk9rcQb6AadyUZVmjoHGcG3VjFGvVei31JXCjNb'
const BUY_LAMPORTS = Number(process.env.DRY_RUN_BUY_LAMPORTS || '1000000') // 0.001 SOL

async function main() {
  const raw = process.env.LAUNCHLAB_PLATFORM_ADMIN_SECRET!.trim()
  const owner = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]))
  const conn = new Connection(getRpcUrl(), 'confirmed')
  console.log('bal', (await conn.getBalance(owner.publicKey)) / 1e9, 'SOL')
  const mintA = new PublicKey(MINT)
  const poolId = new PublicKey(POOL)
  const pool = LaunchpadPool.decode((await conn.getAccountInfo(poolId))!.data)
  console.log({ status: pool.status, realB: pool.realB.toString(), platformId: pool.platformId.toBase58() })

  const raydium = await initSdk({ owner, rpcUrl: getRpcUrl(), cluster: 'mainnet' })
  const { execute } = await raydium.launchpad.buyToken({
    programId: LAUNCHPAD_PROGRAM,
    mintA,
    buyAmount: new BN(BUY_LAMPORTS),
    slippage: new BN(2500),
    txVersion: TxVersion.V0,
  })
  const sent = await execute({ sendAndConfirm: true })
  const sig = typeof sent === 'string' ? sent : ((sent as { txId?: string }).txId ?? String(sent))
  console.log('PASS: curve-buy — https://explorer.solana.com/tx/' + sig)
}

main().catch((e) => {
  console.error('FAIL:', e)
  process.exit(1)
})
