import { isLaunchLabLiveOnLanding } from '@/lib/landing/launchlab-card'
import { getLandingPublicStats } from '@/lib/landing/public-stats'
import { getLaunchControlState } from '@/lib/launch/control'
import { isLaunchModeEnabled } from '@/lib/launch/feature-flag'
import type { LandingPublicStats } from '@/lib/landing/types'
import LandingPageClient from '@/components/landing/LandingPageClient'

export const dynamic = 'force-dynamic'

function fallbackStats(): LandingPublicStats {
  return {
    stats: [
      {
        value: '—',
        label: 'Live stats unavailable',
        note: 'building in public',
      },
      {
        value: 'Fast',
        label: 'Explainable verdicts',
        note: 'latency not published yet',
      },
    ],
    asOfIso: new Date().toISOString(),
    asOfLabel: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    heroScan: null,
    buildingInPublic: true,
  }
}

/** Shared server data for `/` and `/landing`. */
export async function loadLandingPageProps(): Promise<{
  publicStats: LandingPublicStats
  launchLabLive: boolean
}> {
  const [publicStats, launchControl] = await Promise.all([
    getLandingPublicStats().catch(() => fallbackStats()),
    getLaunchControlState().catch(() => ({
      paused: true,
      envPaused: true,
      redisPaused: false,
      launchModeEnabled: isLaunchModeEnabled(),
    })),
  ])

  return {
    publicStats,
    launchLabLive: isLaunchLabLiveOnLanding({
      launchModeEnabled: launchControl.launchModeEnabled,
      paused: launchControl.paused,
    }),
  }
}

export async function LandingPageServer() {
  const props = await loadLandingPageProps()
  return <LandingPageClient {...props} />
}
