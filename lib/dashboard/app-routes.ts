/** Deep-link into the live product shell at /app */
export type AppView =
  | 'scanner'
  | 'portfolio'
  | 'whales'
  | 'alpha'
  | 'feed'
  | 'forensics'
  | 'neuralv4'
  | 'promax'
  | 'elite'

export const APP_VIEWS = new Set<string>([
  'scanner',
  'portfolio',
  'whales',
  'alpha',
  'feed',
  'forensics',
  'neuralv4',
  'promax',
  'elite',
])

export function isAppView(v: string): v is AppView {
  return APP_VIEWS.has(v)
}

export function appToolUrl(view: AppView, extra?: Record<string, string>): string {
  const q = new URLSearchParams({ view })
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v)
    }
  }
  return `/app?${q.toString()}`
}
