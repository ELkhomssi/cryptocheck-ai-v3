import { Redis } from '@upstash/redis'

const disabled = {
  async get(_key: string) {
    return null as string | null
  },
  async set(_key: string, _value: string) {},
  async setex(_key: string, _ttlSec: number, _value: string) {},
  async del(_key: string) {},
  async incr(_key: string) {
    return 1
  },
  async expire(_key: string, _ttlSec: number) {},
} as const

function createRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return disabled
  }
  const client = Redis.fromEnv()
  return {
    async get(key: string) {
      const v = await client.get<string>(key)
      return typeof v === 'string' ? v : v == null ? null : JSON.stringify(v)
    },
    async set(key: string, value: string) {
      await client.set(key, value)
    },
    async setex(key: string, ttlSec: number, value: string) {
      await client.set(key, value, { ex: ttlSec })
    },
    async del(key: string) {
      await client.del(key)
    },
    async incr(key: string) {
      return client.incr(key)
    },
    async expire(key: string, ttlSec: number) {
      await client.expire(key, ttlSec)
    },
  }
}

export const redis = createRedis()
