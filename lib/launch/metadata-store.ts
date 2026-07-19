import 'server-only'

type MetaPayload = {
  mint: string
  name: string
  symbol: string
  description: string
  image: string
}

const memory = new Map<string, MetaPayload>()
const TTL_SEC = 60 * 60 * 24 // 24h

function redisEnabled(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

async function upstashCommand<T = unknown>(args: (string | number)[]): Promise<T | null> {
  if (!redisEnabled()) return null
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`)
  const j = (await res.json()) as { result?: T; error?: string }
  if (j.error) throw new Error(j.error)
  return (j.result ?? null) as T | null
}

function metaKey(mint: string): string {
  return `ccai:launch:meta:${mint}`
}

export async function stashLaunchMetadata(meta: MetaPayload): Promise<void> {
  memory.set(meta.mint, meta)
  try {
    await upstashCommand(['SET', metaKey(meta.mint), JSON.stringify(meta), 'EX', TTL_SEC])
  } catch {
    // memory fallback
  }
}

export async function readLaunchMetadata(mint: string): Promise<MetaPayload | null> {
  try {
    const raw = await upstashCommand<string | null>(['GET', metaKey(mint)])
    if (raw) return JSON.parse(raw) as MetaPayload
  } catch {
    /* fall through */
  }
  return memory.get(mint) ?? null
}
