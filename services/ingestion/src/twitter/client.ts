import { normalizeTwitterHandle } from './resolve-handles.js'

const API = 'https://api.twitter.com/2'

export type TwitterTweet = {
  id: string
  text: string
  created_at?: string
  author_id?: string
  username: string
}

type SearchResponse = {
  data?: Array<{
    id: string
    text: string
    created_at?: string
    author_id?: string
  }>
  includes?: {
    users?: Array<{ id: string; username: string }>
  }
  meta?: { newest_id?: string; oldest_id?: string; result_count?: number }
  errors?: Array<{ message?: string; title?: string }>
  title?: string
  detail?: string
}

/** Chunk handles so each recent-search query stays under ~480 chars. */
export function chunkHandles(handles: string[], maxQueryChars = 480): string[][] {
  const chunks: string[][] = []
  let cur: string[] = []
  let len = 0
  const suffix = ' -is:retweet -is:reply'
  for (const h of handles) {
    const bare = normalizeTwitterHandle(h)
    if (!bare) continue
    const piece = cur.length === 0 ? `from:${bare}` : ` OR from:${bare}`
    if (cur.length > 0 && len + piece.length + suffix.length > maxQueryChars) {
      chunks.push(cur)
      cur = [bare]
      len = `from:${bare}`.length
      continue
    }
    cur.push(bare)
    len += piece.length
  }
  if (cur.length > 0) chunks.push(cur)
  return chunks
}

export function buildRecentSearchQuery(handles: string[]): string {
  const parts = handles.map((h) => `from:${normalizeTwitterHandle(h)}`)
  return `${parts.join(' OR ')} -is:retweet -is:reply`
}

/**
 * X API v2 recent search (app-only bearer).
 * Requires a product that includes recent search (Basic+).
 */
export async function searchRecentTweets(opts: {
  bearerToken: string
  handles: string[]
  sinceId?: string
  maxResults?: number
}): Promise<{ tweets: TwitterTweet[]; newestId?: string }> {
  if (opts.handles.length === 0) return { tweets: [] }

  const params = new URLSearchParams({
    query: buildRecentSearchQuery(opts.handles),
    max_results: String(Math.min(100, Math.max(10, opts.maxResults ?? 25))),
    'tweet.fields': 'created_at,author_id,entities',
    expansions: 'author_id',
    'user.fields': 'username',
  })
  if (opts.sinceId) params.set('since_id', opts.sinceId)

  const res = await fetch(`${API}/tweets/search/recent?${params}`, {
    headers: {
      Authorization: `Bearer ${opts.bearerToken}`,
      'User-Agent': 'CryptoCheckAI-SignalIngestion/1.0',
    },
    cache: 'no-store',
  })

  const body = (await res.json()) as SearchResponse
  if (!res.ok) {
    const msg = body.detail || body.title || body.errors?.[0]?.message || `HTTP ${res.status}`
    throw new Error(`twitter search failed: ${msg}`)
  }

  const users = new Map((body.includes?.users ?? []).map((u) => [u.id, u.username]))
  const tweets: TwitterTweet[] = (body.data ?? []).map((t) => ({
    id: t.id,
    text: t.text,
    created_at: t.created_at,
    author_id: t.author_id,
    username: (t.author_id && users.get(t.author_id)) || 'unknown',
  }))

  return { tweets, newestId: body.meta?.newest_id }
}
