/** Time-aware greeting — never invents market facts. */

export function greetingForNow(now = new Date()): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning.'
  if (h < 18) return 'Good afternoon.'
  return 'Good evening.'
}
