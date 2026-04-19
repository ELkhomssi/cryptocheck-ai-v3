import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Permanent redirects for legacy / spam URLs (e.g. "company website" crawl noise).
 * next.config.js `redirects` cannot match arbitrary substrings in a path; this middleware can.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const haystack = `${pathname}${search}`.toLowerCase()
  if (haystack.includes('company')) {
    return NextResponse.redirect(new URL('/', request.url), 308)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
