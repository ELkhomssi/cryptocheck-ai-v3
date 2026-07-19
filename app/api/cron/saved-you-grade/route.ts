import { NextResponse } from 'next/server'
import { runSavedYouGrading } from '@/lib/launchpad/saved-you-grade'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET/POST /api/cron/saved-you-grade
 * Authorize with CRON_SECRET. Grades pending user_blocks → saved_you on real rugs only.
 */
export async function GET(req: Request) {
  return run(req)
}

export async function POST(req: Request) {
  return run(req)
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const q = new URL(req.url).searchParams.get('secret') ?? ''
  if (secret && auth !== secret && q !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runSavedYouGrading()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
}
