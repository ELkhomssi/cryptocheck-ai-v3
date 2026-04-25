import type { NextRequest } from 'next/server'
import { handleStripeWebhook } from '@/lib/stripe/handle-stripe-webhook'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handleStripeWebhook(req)
}
