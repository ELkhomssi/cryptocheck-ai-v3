import { LandingPageServer } from '@/lib/landing/load-landing-page'

export const dynamic = 'force-dynamic'

/** `/landing` — same marketing surface as `/`. */
export default async function LandingRoutePage() {
  return <LandingPageServer />
}
