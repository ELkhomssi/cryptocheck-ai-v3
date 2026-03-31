import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, password, referralSource, walletAddress } = await req.json()

    // 1. Create auth user with referral in metadata
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // sends confirmation email
      user_metadata: {
        referral_source: referralSource || 'direct',
        wallet_address:  walletAddress || null,
      }
    })

    if (error) throw error

    // 2. Upsert profile (trigger handles it but we ensure data)
    await supabase.from('profiles').upsert({
      id:               data.user.id,
      email:            email,
      referral_source:  referralSource || 'direct',
      wallet_address:   walletAddress || null,
      trial_started_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, userId: data.user.id })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Signup failed' },
      { status: 500 }
    )
  }
}
