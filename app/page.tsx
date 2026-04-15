'use client'
import LandingPage from './landing/page'

/** Root `/` always renders the marketing landing page (no auth-based redirect to `/app`). */
export default function RootPage() {
  return <LandingPage />
}
