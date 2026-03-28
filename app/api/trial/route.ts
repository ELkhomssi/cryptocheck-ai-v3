import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TRIAL_DAYS   = 4

async function db(path: string, method = 'GET', body?: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=representation',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return r.json()
}

export async function POST(req: NextRequest) {
  try {
    const { deviceId, walletAddress } = await req.json()
    if (!deviceId) return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })

    const key = walletAddress || deviceId

    // Check existing trial
    const existing = await db(`trial_users?device_id=eq.${encodeURIComponent(key)}&select=*`)
    
    let trialStart: string
    let isPro = false

    if (Array.isArray(existing) && existing.length > 0) {
      trialStart = existing[0].trial_start
      isPro      = existing[0].is_pro || false
    } else {
      // Create new trial
      trialStart = new Date().toISOString()
      await db('trial_users', 'POST', {
        device_id:   key,
        trial_start: trialStart,
        is_pro:      false,
        wallet:      walletAddress || null,
        created_at:  trialStart,
      })
    }

    const start     = new Date(trialStart)
    const now       = new Date()
    const diffMs    = now.getTime() - start.getTime()
    const diffDays  = diffMs / (1000 * 60 * 60 * 24)
    const remaining = Math.max(0, TRIAL_DAYS - diffDays)
    const expired   = diffDays >= TRIAL_DAYS && !isPro

    const remHours  = Math.floor(remaining * 24)
    const remMins   = Math.floor((remaining * 24 * 60) % 60)

    return NextResponse.json({
      deviceId:     key,
      trialStart,
      trialDays:    TRIAL_DAYS,
      daysUsed:     Math.min(diffDays, TRIAL_DAYS),
      daysRemaining: remaining,
      hoursRemaining: remHours,
      minsRemaining:  remMins,
      expired,
      isPro,
      displayTime:  expired ? 'EXPIRED' : `${Math.floor(remaining)}d ${remHours % 24}h ${remMins}m`,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
