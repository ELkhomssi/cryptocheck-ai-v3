import 'server-only'

export type LaunchMetaPayload = {
  mint: string
  name: string
  symbol: string
  description: string
  image: string
  external_url?: string
  website?: string
  twitter?: string
  telegram?: string
  discord?: string
  /** Prefer IPFS URI when Pinata succeeded. */
  metadataUri?: string
  checksumSha256?: string
}

const memory = new Map<string, LaunchMetaPayload>()
/** 30 days — covers bonding curve + early post-migrate discovery. */
const TTL_SEC = 60 * 60 * 24 * 30

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

export async function stashLaunchMetadata(meta: LaunchMetaPayload): Promise<void> {
  memory.set(meta.mint, meta)
  try {
    await upstashCommand(['SET', metaKey(meta.mint), JSON.stringify(meta), 'EX', TTL_SEC])
  } catch {
    // memory fallback
  }
}

export async function readLaunchMetadata(mint: string): Promise<LaunchMetaPayload | null> {
  try {
    const raw = await upstashCommand<string | null>(['GET', metaKey(mint)])
    if (raw) return JSON.parse(raw) as LaunchMetaPayload
  } catch {
    /* fall through */
  }
  return memory.get(mint) ?? null
}
