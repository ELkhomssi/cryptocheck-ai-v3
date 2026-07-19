/**
 * Smoke-check landing honesty gates (no Next server required).
 * Run: node --import tsx scripts/verify-landing-honesty.ts
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import {
  isLaunchLabLiveOnLanding,
  launchLabHubCopy,
  LAUNCHLAB_WAITLIST_HREF,
} from '../lib/landing/launchlab-card'
import { DEFAULT_PLATFORM_FEE_BPS } from '../lib/revenue-dashboard/constants'
import { LAUNCHPAD_FEE_NOTE } from '../lib/launchpad/constants'

config({ path: '.env.local' })

const root = resolve(process.cwd())
const robotPath = resolve(root, 'public/images/robot-hero.png')
const fails: string[] = []

function ok(msg: string) {
  console.log(`PASS  ${msg}`)
}
function fail(msg: string) {
  fails.push(msg)
  console.error(`FAIL  ${msg}`)
}

// 1 — robot asset must be gone
if (existsSync(robotPath)) fail('public/images/robot-hero.png still exists')
else ok('robot-hero.png removed from public/')

// 2 — fee microcopy is flat platform fee, not performance fee
const feePct = (DEFAULT_PLATFORM_FEE_BPS / 100).toFixed(2)
const sniperLine = `Transparent ${feePct}% platform fee, shown before every trade. ${LAUNCHPAD_FEE_NOTE}`
if (/only on profits|on profitable|performance fee/i.test(sniperLine)) {
  fail(`fee copy still looks like a performance fee: ${sniperLine}`)
} else {
  ok(`Auto-Sniper fee line: ${sniperLine}`)
}

// 3 — LaunchLAB CTA flips both ways (flag-driven)
const pausedCopy = launchLabHubCopy(
  isLaunchLabLiveOnLanding({ launchModeEnabled: true, paused: true }),
)
const liveCopy = launchLabHubCopy(
  isLaunchLabLiveOnLanding({ launchModeEnabled: true, paused: false }),
)
if (pausedCopy.href !== LAUNCHLAB_WAITLIST_HREF) fail(`paused href=${pausedCopy.href}`)
else ok(`paused → ${pausedCopy.hrefLabel}`)
if (liveCopy.href !== '/launchLab') fail(`live href=${liveCopy.href}`)
else ok(`live → ${liveCopy.hrefLabel}`)

// 4 — local .env.local prediction (informational)
const enabled = ['1', 'true', 'yes'].includes(
  (process.env.NEXT_PUBLIC_LAUNCH_MODE_ENABLED ?? '').trim().toLowerCase(),
)
const paused = ['1', 'true', 'yes'].includes(
  (process.env.LAUNCH_MODE_PAUSED ?? '').trim().toLowerCase(),
)
const envLive = isLaunchLabLiveOnLanding({ launchModeEnabled: enabled, paused })
const envCopy = launchLabHubCopy(envLive)
console.log(
  `INFO  .env.local → enabled=${enabled} paused=${paused} → landing CTA "${envCopy.hrefLabel}"`,
)

if (fails.length) {
  console.error(`\n${fails.length} failure(s)`)
  process.exit(1)
}
console.log('\nLanding honesty smoke OK')
