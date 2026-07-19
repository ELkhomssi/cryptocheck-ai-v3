import { redirect } from 'next/navigation'

/**
 * Secondary Revenue Terminal removed — Scan / Swap / Sniper live on Official Dashboard.
 * Old URLs (badge, terminal, …) redirect for safety. /app is untouched.
 */
export default function RevenueDashboardRedirect() {
  redirect('/dashboard')
}
