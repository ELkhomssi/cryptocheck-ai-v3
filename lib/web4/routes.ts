/** Consumer launchpad — separate from /dashboard (API keys & developer tools). */
export const WEB4_BASE_PATH = '/web4'

export function web4Url(params?: Record<string, string>) {
  if (!params || Object.keys(params).length === 0) return WEB4_BASE_PATH
  return `${WEB4_BASE_PATH}?${new URLSearchParams(params).toString()}`
}
