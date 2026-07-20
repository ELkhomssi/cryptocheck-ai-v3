import { redirect } from 'next/navigation'

/** Legacy Launchpad swap UI removed — hand off to unified Action Panel. */
export default function LegacyLaunchpadSwapRedirect({
  searchParams,
}: {
  searchParams: { mint?: string }
}) {
  const mint = searchParams.mint?.trim()
  if (mint && mint.length >= 32) {
    redirect(`/dashboard?mint=${encodeURIComponent(mint)}&mode=swap#action-panel`)
  }
  redirect('/dashboard?mode=swap#action-panel')
}
