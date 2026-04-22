import { NextResponse } from 'next/server'
import { collectHealthSnapshot } from '@/lib/status/health-snapshot'

export const dynamic = 'force-dynamic'

export async function GET() {
  const snapshot = await collectHealthSnapshot()
  const criticalOk = snapshot.status === 'healthy'
  const status = criticalOk ? 200 : 503

  return NextResponse.json(snapshot, { status })
}
