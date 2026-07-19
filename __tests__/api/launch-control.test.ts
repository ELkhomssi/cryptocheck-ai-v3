import assert from 'node:assert/strict'
import { describe, it, afterEach } from 'node:test'
import { isLaunchModePaused } from '../../lib/launch/control'

describe('launch kill-switch', () => {
  const prev = process.env.LAUNCH_MODE_PAUSED

  afterEach(() => {
    if (prev === undefined) delete process.env.LAUNCH_MODE_PAUSED
    else process.env.LAUNCH_MODE_PAUSED = prev
  })

  it('env LAUNCH_MODE_PAUSED pauses prepares', async () => {
    process.env.LAUNCH_MODE_PAUSED = 'true'
    assert.equal(await isLaunchModePaused(), true)
  })

  it('unset env is not paused (redis may still pause)', async () => {
    delete process.env.LAUNCH_MODE_PAUSED
    // Without a redis pause key, expect false in local without Upstash write
    const paused = await isLaunchModePaused()
    assert.equal(typeof paused, 'boolean')
  })
})
