import { NextResponse } from 'next/server'
import { processWebhookRetryQueue } from '@/lib/webhooks/retry-queue'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stats = await processWebhookRetryQueue({ limit: 50 })
  return NextResponse.json(stats)
}
