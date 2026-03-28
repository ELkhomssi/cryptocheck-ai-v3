// ══════════════════════════════════════════════
//  CryptoCheck AI — Trial System
//  4-day free trial with device fingerprinting
// ══════════════════════════════════════════════

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

// ── Device fingerprint (no external lib needed) ──
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr'

  // Check if already generated
  const stored = localStorage.getItem('cc_device_id')
  if (stored) return stored

  // Generate fingerprint from browser properties
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.platform || '',
  ].join('|')

  // Simple hash
  let hash = 0
  for (let i = 0; i < components.length; i++) {
    const char = components.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  const deviceId = 'dev_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36)
  localStorage.setItem('cc_device_id', deviceId)
  return deviceId
}

// ── Check trial status ──
export async function checkTrialStatus(walletAddress?: string | null): Promise<TrialStatus> {
  try {
    const deviceId = getDeviceId()
    const res = await fetch('/api/trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, walletAddress: walletAddress || null }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data as TrialStatus
  } catch {
    // Fallback — localStorage only
    return getLocalTrial()
  }
}

// ── Fallback local trial (if API fails) ──
function getLocalTrial(): TrialStatus {
  const TRIAL_DAYS = 4
  const isPro = localStorage.getItem('cc_is_pro') === 'true'

  let trialStart = localStorage.getItem('cc_trial_start')
  if (!trialStart) {
    trialStart = new Date().toISOString()
    localStorage.setItem('cc_trial_start', trialStart)
  }

  const start       = new Date(trialStart)
  const now         = new Date()
  const diffMs      = now.getTime() - start.getTime()
  const diffDays    = diffMs / (1000 * 60 * 60 * 24)
  const remaining   = Math.max(0, TRIAL_DAYS - diffDays)
  const expired     = diffDays >= TRIAL_DAYS && !isPro
  const remHours    = Math.floor(remaining * 24)
  const remMins     = Math.floor((remaining * 24 * 60) % 60)

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
