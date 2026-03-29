import { NextRequest, NextResponse } from 'next/server'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TRIAL_DAYS   = 4
async function db(path: string, method = 'GET', body?: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers: { 'apikey':SERVICE_KEY,'Authorization':`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json','Prefer':method==='POST'?'resolution=merge-duplicates,return=representation':'return=representation' }, ...(body?{body:JSON.stringify(body)}:{}) })
  return r.json()
}
export async function POST(req: NextRequest) {
  try {
    const { walletAddress, email, deviceId } = await req.json()
    if (!walletAddress || !email) return NextResponse.json({ error:'Wallet and email required' }, { status:400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error:'Invalid email' }, { status:400 })
    const now = new Date().toISOString()
    const existing = await db(`trial_users?wallet=eq.${encodeURIComponent(walletAddress)}&select=*`)
    if (Array.isArray(existing) && existing.length > 0) {
      const u = existing[0]
      const diff = (Date.now()-new Date(u.trial_start).getTime())/(1000*60*60*24)
      const rem = Math.max(0,TRIAL_DAYS-diff)
      const rh = Math.floor(rem*24)
      return NextResponse.json({ success:true, alreadyExists:true, trialStart:u.trial_start, expired:diff>=TRIAL_DAYS&&!u.is_pro, isPro:u.is_pro||false, daysRemaining:rem, hoursRemaining:rh, displayTime:`${Math.floor(rem)}d ${rh%24}h` })
    }
    await db('trial_users','POST',{ device_id:deviceId||walletAddress, wallet:walletAddress, email:email.toLowerCase().trim(), trial_start:now, is_pro:false, created_at:now })
    try { await db('users','POST',{ wallet_address:walletAddress, email:email.toLowerCase().trim(), trial_start_date:now, is_pro:false, created_at:now, updated_at:now }) } catch {}
    return NextResponse.json({ success:true, alreadyExists:false, trialStart:now, expired:false, isPro:false, daysRemaining:TRIAL_DAYS, hoursRemaining:TRIAL_DAYS*24, displayTime:`${TRIAL_DAYS}d 0h` })
  } catch(err) {
    return NextResponse.json({ error:err instanceof Error?err.message:'Server error' }, { status:500 })
  }
}
