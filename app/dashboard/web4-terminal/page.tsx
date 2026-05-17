import { redirect } from 'next/navigation'
import { WEB4_BASE_PATH } from '@/lib/web4/routes'

/** Legacy URL — Web4 lives on its own consumer dashboard. */
export default function LegacyWeb4TerminalRedirect() {
  redirect(WEB4_BASE_PATH)
}
