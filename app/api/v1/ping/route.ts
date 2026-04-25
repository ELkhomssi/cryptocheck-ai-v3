import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/middleware/with-api-auth'

/**
 * Smoke test for API key auth + rate limits. Returns tier for the authenticated key.
 */
export const GET = withApiAuth(async (_req: NextRequest, ctx) => {
  return Response.json({
    ok: true,
    tier: ctx.tier,
    user_id: ctx.userId,
  })
})
