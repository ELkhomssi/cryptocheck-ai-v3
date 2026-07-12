import { redirect } from 'next/navigation'

/**
 * Legacy /app entry used the old 3k-line dashboard.tsx.
 * Smart Alpha Feed (NORO-style) lives at /dashboard — send everyone there.
 */
export default function AppPage() {
  redirect('/dashboard')
}
