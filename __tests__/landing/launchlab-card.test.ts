import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isLaunchLabLiveOnLanding, launchLabHubCopy, LAUNCHLAB_WAITLIST_HREF } from '@/lib/landing/launchlab-card'

describe('launchLabHubCopy (landing flag-driven CTA)', () => {
  it('paused → waitlist CTA, not live route', () => {
    const live = isLaunchLabLiveOnLanding({ launchModeEnabled: true, paused: true })
    assert.equal(live, false)
    const copy = launchLabHubCopy(live)
    assert.equal(copy.href, LAUNCHLAB_WAITLIST_HREF)
    assert.match(copy.hrefLabel, /final security review/i)
    assert.notEqual(copy.href, '/launchLab')
  })

  it('enabled + unpaused → Open /launchLab', () => {
    const live = isLaunchLabLiveOnLanding({ launchModeEnabled: true, paused: false })
    assert.equal(live, true)
    const copy = launchLabHubCopy(live)
    assert.equal(copy.href, '/launchLab')
    assert.match(copy.hrefLabel, /Open \/launchLab/i)
  })

  it('feature flag off → waitlist even if not paused', () => {
    const live = isLaunchLabLiveOnLanding({ launchModeEnabled: false, paused: false })
    assert.equal(live, false)
    assert.equal(launchLabHubCopy(live).href, LAUNCHLAB_WAITLIST_HREF)
  })
})
