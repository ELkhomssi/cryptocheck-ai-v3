import { redirect } from 'next/navigation'

/** Legacy path — canonical desk is /terminal. */
export default function PortfolioRedirectPage() {
  redirect('/terminal')
}
