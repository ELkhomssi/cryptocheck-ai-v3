import 'server-only'
import { Redis } from '@upstash/redis'
import type { ProtocolStats } from './types'

const PREFIX = 'web4:stats'
const KEYS = {
  volume: `${PREFIX}:volume_lamports`,
  graduated: `${PREFIX}:graduated`,
  pools: `${PREFIX}:active_pools`,
  wallets: `${PREFIX}:wallets`,
} as const

function redis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return Redis.fromEnv()
}

export async function indexProtocolEvent(event: {
  type: 'trade' | 'graduate' | 'deploy'
  lamports?: bigint
  wallet?: string
}) {
  const r = redis()
  if (!r) return

  if (event.type === 'trade' && event.lamports) {
    await r.incrby(KEYS.volume, Number(event.lamports))
  }
  if (event.type === 'graduate') {
    await r.incr(KEYS.graduated)
  }
  if (event.type === 'deploy') {
    await r.incr(KEYS.pools)
  }
  if (event.wallet) {
    await r.sadd(`${PREFIX}:wallet_set`, event.wallet)
    const count = await r.scard(`${PREFIX}:wallet_set`)
    await r.set(KEYS.wallets, count)
  }
}

export async function getIndexedStats(solUsd: number): Promise<ProtocolStats | null> {
  const r = redis()
  if (!r) return null

  const [volume, graduated, pools, wallets] = await Promise.all([
    r.get<string>(KEYS.volume),
    r.get<number>(KEYS.graduated),
    r.get<number>(KEYS.pools),
    r.get<number>(KEYS.wallets),
  ])

  return {
    totalVolumeLamports: volume?.toString() ?? '0',
    tokensGraduated: Number(graduated ?? 0),
    activePools: Number(pools ?? 0),
    connectedWalletsEstimate: Number(wallets ?? 0),
    solUsd,
    updatedAt: Date.now(),
    source: 'indexed',
  }
}
