import { redirect } from 'next/navigation'

/** Legacy signals product page → Official Dashboard (Alpha / Sports tabs). */
export default function SignalsRedirectPage() {
  redirect('/dashboard')
}
