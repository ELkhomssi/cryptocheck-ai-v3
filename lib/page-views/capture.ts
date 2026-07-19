/**
 * Pageview capture helpers used by middleware (Edge-safe).
 * Keep free of Node-only APIs so Edge middleware can import this module.
 */

export const BOT_UA_PATTERN =
  /bot|crawler|spider|slurp|headless|curl|wget|python-requests|scrapy|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|preview|monitor|pingdom|uptimerobot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot/i

export const PV_SID_COOKIE = 'pv_sid'
export const PV_SID_MAX_AGE = 60 * 60 * 24 * 30

export function isBot(ua: string | null): boolean {
  if (!ua) return true
  return BOT_UA_PATTERN.test(ua)
}

export async function hashIp(raw: string | null, salt = process.env.IP_HASH_SALT ?? ''): Promise<string | null> {
  if (!raw) return null
  const enc = new TextEncoder().encode(raw + salt)
  const digest = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function pickClientIp(headers: Headers, requestIp?: string | null): string | null {
  const cf = headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const xff = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (xff) return xff
  const real = headers.get('x-real-ip')?.trim()
  if (real) return real
  return typeof requestIp === 'string' && requestIp.trim() ? requestIp.trim() : null
}

export type PageViewPayload = {
  session_id: string
  ip_address: string | null
  user_agent: string | null
  referrer: string | null
  path: string
}

export async function insertPageView(payload: PageViewPayload): Promise<{ ok: boolean; status?: number }> {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceKey) return { ok: false }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/page_views`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error('[page_views] insert failed', res.status, await res.text().catch(() => ''))
      return { ok: false, status: res.status }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    console.error('[page_views] insert failed', err)
    return { ok: false }
  }
}
