import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server'
import { runEdgeBotProtection } from '@/lib/bot-protection/edge'
import {
  PV_SID_COOKIE,
  PV_SID_MAX_AGE,
  hashIp,
  insertPageView,
  isBot,
  pickClientIp,
} from '@/lib/page-views/capture'

/**
 * Edge middleware:
 * 1) Legacy redirects
 * 2) Bot protection (search engines always allowed; &lt;5ms target for clean traffic)
 * 3) Pageview capture (non-bot HTML)
 *
 * FULL_ACCESS remains in API route handlers — not here.
 */

async function logPageView(request: NextRequest, response: NextResponse): Promise<void> {
  const sessionId =
    response.cookies.get(PV_SID_COOKIE)?.value ?? request.cookies.get(PV_SID_COOKIE)?.value ?? null
  if (!sessionId) return

  const maybeIp = (request as NextRequest & { ip?: string }).ip
  await insertPageView({
    session_id: sessionId,
    ip_address: await hashIp(pickClientIp(request.headers, maybeIp)),
    user_agent: request.headers.get('user-agent'),
    referrer: request.headers.get('referer'),
    path: request.nextUrl.pathname,
  })
}

function attachPageView(request: NextRequest, response: NextResponse, event: NextFetchEvent): void {
  const ua = request.headers.get('user-agent')
  if (isBot(ua)) return
  // Skip pageviews for API
  if (request.nextUrl.pathname.startsWith('/api/')) return

  if (!request.cookies.get(PV_SID_COOKIE)?.value) {
    response.cookies.set(PV_SID_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: PV_SID_MAX_AGE,
      secure: process.env.NODE_ENV === 'production',
    })
  }

  event.waitUntil(logPageView(request, response))
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = request.nextUrl
  const haystack = `${pathname}${search}`.toLowerCase()

  if (haystack.includes('company')) {
    const response = NextResponse.redirect(new URL('/', request.url), 308)
    attachPageView(request, response, event)
    return response
  }

  if (
    pathname === '/launchlab' ||
    pathname === '/LaunchLab' ||
    pathname === '/LaunchLAB' ||
    pathname === '/LAUNCHLAB'
  ) {
    const response = NextResponse.redirect(new URL(`/launchLab${search}`, request.url), 308)
    attachPageView(request, response, event)
    return response
  }

  const bot = await runEdgeBotProtection(request)
  if (bot.response) {
    // Do not attach pageviews for blocked / challenged traffic
    return bot.response
  }

  const response = NextResponse.next()
  if (bot.result.botScore > 0) {
    response.headers.set('X-CCAI-BotScore', String(bot.result.botScore))
  }
  attachPageView(request, response, event)
  return response
}

export const config = {
  matcher: [
    /*
     * Run on pages + API (bot defense). Exclude Next internals & static assets.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|woff|woff2)$).*)',
  ],
}
