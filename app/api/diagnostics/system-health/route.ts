import { NextRequest, NextResponse } from 'next/server'
import { assertDiagnosticsAdmin } from '@/lib/diagnostics/admin-auth'
import { collectSystemDiagnostics } from '@/lib/diagnostics/metrics-collector'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * READ-ONLY system diagnostics (admin session or Bearer DIAGNOSTICS_ADMIN_SECRET).
 */
export async function GET(req: NextRequest) {
  const auth = await assertDiagnosticsAdmin(req.headers.get('authorization'))
  if (auth.ok === false) return auth.response

  try {
    const body = await collectSystemDiagnostics()
    return NextResponse.json(body)
  } catch (e) {
    console.error('[diagnostics/system-health]', e)
    return NextResponse.json(
      {
        error: 'Diagnostics collection failed',
        detail: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
