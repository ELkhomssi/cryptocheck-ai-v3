import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasFullPlatformAccess } from '@/lib/billing/full-access'
import { scanApiErrorPayload } from '@/lib/api/scan-api-errors'

/** Session-auth gate for premium platform features (neural, alpha feed, sniper APIs). */
export async function requireSessionFullAccess(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        scanApiErrorPayload('Sign in required', 401, 'UNAUTHORIZED', {
          reason: 'UNAUTHORIZED',
          severity: 'medium',
        }),
        { status: 401 },
      ),
    }
  }

  const allowed = await userHasFullPlatformAccess(user.id)
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        scanApiErrorPayload(
          'Full platform access required. Choose Basic or Pro on the upgrade page.',
          403,
          'FULL_ACCESS_REQUIRED',
          { reason: 'FULL_ACCESS_REQUIRED', severity: 'medium' },
        ),
        { status: 403 },
      ),
    }
  }

  return { ok: true, userId: user.id }
}
