import { redirect } from 'next/navigation'

/** Legacy Launchpad sniper UI removed — hand off to unified Action Panel. */
export default function LegacyLaunchpadSniperRedirect() {
  redirect('/dashboard?mode=sniper#action-panel')
}
