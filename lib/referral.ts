export function captureReferral() {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref')
  if (ref) localStorage.setItem('cc_referral', ref)
}

export function getReferral(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('cc_referral') || 'direct'
}

export function clearReferral() {
  localStorage.removeItem('cc_referral')
}
