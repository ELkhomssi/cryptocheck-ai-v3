import { redirect } from 'next/navigation'

/** Legacy primary-nav route — relocated to Settings → Intelligence Engine. */
export default function AiEmployeesRedirectPage() {
  redirect('/settings/intelligence-engine')
}
