/**
 * LaunchLAB product-map CTA status — must stay derived from real flags,
 * never hardcoded on the landing page.
 */
export function isLaunchLabLiveOnLanding(input: {
  launchModeEnabled: boolean
  paused: boolean
}): boolean {
  return input.launchModeEnabled && !input.paused
}

export const LAUNCHLAB_WAITLIST_HREF = '/signup?interest=launchlab'

export function launchLabHubCopy(live: boolean): {
  eyebrow: string
  desc: string
  href: string
  hrefLabel: string
} {
  if (live) {
    return {
      eyebrow: 'CREATE',
      desc: 'Discover and launch on Raydium LaunchLab. Scanner-gated — non-custodial.',
      href: '/launchLab',
      hrefLabel: 'Open /launchLab →',
    }
  }
  return {
    eyebrow: 'CREATE · REVIEW',
    desc: 'Token create is in final security review (migration-integrity protocol). Scan / Swap / Sniper stay live.',
    href: LAUNCHLAB_WAITLIST_HREF,
    hrefLabel: 'In final security review — join the list',
  }
}
