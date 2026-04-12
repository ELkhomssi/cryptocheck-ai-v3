import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const svc = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET — fetch user's referral data
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const sb = svc()

  // Get profile with referral code
  const { data: profile } = await sb.from('profiles').select('referral_code, referral_count, referral_earnings_sol').eq('id', userId).single()

  // Get commissions
  const { data: commissions } = await sb.from('commissions').select('*').eq('referrer_id', userId).order('created_at', { ascending: false }).limit(20)

  // Get referred users count
  const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', profile?.referral_code || '')

  return NextResponse.json({
    referralCode: profile?.referral_code || '',
    referralLink: `https://www.cryptocheckai.com?ref=${profile?.referral_code || ''}`,
    totalReferred: count || profile?.referral_count || 0,
    totalEarningsSol: profile?.referral_earnings_sol || 0,
    commissions: commissions || [],
  })
}

// POST — save referral on signup
export async function POST(req: NextRequest) {
  const { userId, refCode } = await req.json()
  if (!userId || !refCode) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const sb = svc()

  // Verify referral code exists
  const { data: referrer } = await sb.from('profiles').select('id, referral_code').eq('referral_code', refCode).single()
  if (!referrer) return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })

  // Don't self-refer
  if (referrer.id === userId) return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })

  // Save referred_by
  await sb.from('profiles').update({ referred_by: refCode }).eq('id', userId)

  // Increment referrer count
  await sb.from('profiles').update({ referral_count: (referrer as any).referral_count ? (referrer as any).referral_count + 1 : 1 }).eq('id', referrer.id)

  return NextResponse.json({ success: true, referrer: referrer.referral_code })
}
