import { LandingPageServer } from '@/lib/landing/load-landing-page'

export const dynamic = 'force-dynamic'

/** Root `/` always renders the marketing landing page (no auth-based redirect to `/app`). */
export default async function RootPage() {
  return <LandingPageServer />
}
