import { Redis } from '@upstash/redis'

export function createRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required')
  }
  return new Redis({ url, token })
}

type UpstashResponse<T> = { result?: T; error?: string }

/** Low-level REST command for stream primitives not on the SDK surface. */
export async function upstashCommand<T>(...args: (string | number)[]): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) throw new Error('Redis env missing')

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(args.map(String)),
  })
  const json = (await res.json()) as UpstashResponse<T>
  if (json.error) throw new Error(json.error)
  return json.result as T
}
