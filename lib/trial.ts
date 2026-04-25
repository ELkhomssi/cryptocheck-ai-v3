import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TRIAL_DAYS = 4

export interface TrialStatus {
  expired:        boolean
  isPro:          boolean
  daysRemaining:  number
  hoursRemaining: number
  minsRemaining:  number
  displayTime:    string
  trialStart:     string
  deviceId:       string
}

export async function checkTrialStatus(walletAddress?: string | null): Promise<TrialStatus> {
  try {
    // Try Supabase first
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('trial_started_at, is_pro, plan')
        .eq('id', user.id)
        .single()

      if (profile) {
        const plan = String(profile.plan || '').toLowerCase()
        const hasPaidPlan =
          !!profile.is_pro ||
          plan === 'starter' ||
          plan === 'deep' ||
          plan === 'elite' ||
          plan === 'pro' ||
          plan === 'whale' ||
          plan === 'institutional' ||
          plan === 'enterprise'
        return computeTrial(profile.trial_started_at, hasPaidPlan)
      }
    }

    // Fallback: wallet-based via API
    const deviceId = getDeviceId()
    const res = await fetch('/api/trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, walletAddress }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data

  } catch {
    return getLocalTrial()
  }
}

function computeTrial(trialStart: string, isPro: boolean): TrialStatus {
  const start     = new Date(trialStart)
  const now       = new Date()
  const diffMs    = now.getTime() - start.getTime()
  const diffDays  = diffMs / (1000 * 60 * 60 * 24)
  const remaining = Math.max(0, TRIAL_DAYS - diffDays)
  const expired   = diffDays >= TRIAL_DAYS && !isPro
  const remHours  = Math.floor(remaining * 24)
  const remMins   = Math.floor((remaining * 24 * 60) % 60)

  return {
    expired,
    isPro,
    daysRemaining:  remaining,
    hoursRemaining: remHours,
    minsRemaining:  remMins,
    displayTime:    expired ? 'EXPIRED' : `${Math.floor(remaining)}d ${remHours % 24}h ${remMins}m`,
    trialStart,
    deviceId:       getDeviceId(),
  }
}

function getLocalTrial(): TrialStatus {
  const isPro = typeof window !== 'undefined' && localStorage.getItem('cc_is_pro') === 'true'
  // Read all possible trial start keys — never overwrite existing
  const trialStart = 
    localStorage.getItem('cc_trial_start') ||
    localStorage.getItem('cc_trial_activation_time') ||
    (() => {
      const t = new Date().toISOString()
      localStorage.setItem('cc_trial_start', t)
      return t
    })()
  return computeTrial(trialStart, isPro)
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr'
  const stored = localStorage.getItem('cc_device_id')
  if (stored) return stored
  const id = 'dev_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36)
  localStorage.setItem('cc_device_id', id)
  return id
}
// cache bust Jeu  9 avr 2026 17:46:20 +01
