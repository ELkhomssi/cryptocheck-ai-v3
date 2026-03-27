import { NextRequest, NextResponse } from 'next/server'

const DEST_WALLET = '5jbWsijUWqXLyuaNtzkiu2JM1C5jNPUP9oRjKmmJx15i'
const PLAN_DAYS: Record<string, number> = { weekly: 7, yearly: 365, vip: 30 }

export async function POST(req: NextRequest) {
  const { plan, coin, signature, wallet } = await req.json()
  if (!plan || !signature || !wallet) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + (PLAN_DAYS[plan] ?? 7))

  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates',
  }

  const [r1, r2] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/users`, {
      method: 'POST', headers,
      body: JSON.stringify({ wallet_address: wallet, is_pro: true, plan, subscription_expires_at: expiresAt.toISOString(), last_payment_coin: coin ?? 'SOL', last_payment_tx: signature, updated_at: new Date().toISOString() }),
    }),
    fetch(`${supabaseUrl}/rest/v1/crypto_payments`, {
      method: 'POST', headers,
      body: JSON.stringify({ wallet_address: wallet, plan, coin: coin ?? 'SOL', tx_signature: signature, expires_at: expiresAt.toISOString(), created_at: new Date().toISOString() }),
    }),
  ])

  const t1 = await r1.text()
  const t2 = await r2.text()
  console.log('[Verify] users:', r1.status, t1)
  console.log('[Verify] payments:', r2.status, t2)

  return NextResponse.json({ success: r1.ok, plan, expiresAt: expiresAt.toISOString() })
}
