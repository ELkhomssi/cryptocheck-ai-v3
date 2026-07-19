import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server'
import {
  PV_SID_COOKIE,
  PV_SID_MAX_AGE,
  hashIp,
  insertPageView,
  isBot,
  pickClientIp,
} from '@/lib/page-views/capture'

/**
 * Permanent redirects for legacy / spam URLs (e.g. "company website" crawl noise).
 * FULL_ACCESS is enforced in API route handlers (`withFullAccessApiAuth`, `requireSessionFullAccess`)
 * and via webhook-updated `saas_subscriptions.full_access` — not in middleware (API keys lack cookies).
 *
 * Pageview capture (`page_views`) runs non-blocking via NextFetchEvent.waitUntil for non-bot HTML navigations.
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

export function middleware(request: NextRequest, event: NextFetchEvent) {
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

  const response = NextResponse.next()
  attachPageView(request, response, event)
  return response
}

export const config = {
  matcher: [
    // Existing exclusions + pageview static asset extensions (css|js|woff).
    '/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|woff|woff2)$).*)',
  ],
}
