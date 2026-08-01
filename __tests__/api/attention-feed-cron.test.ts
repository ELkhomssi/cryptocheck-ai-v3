/**
 * Attention feed cron auth gate.
 * Run: node --import tsx --test __tests__/api/attention-feed-cron.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('attention-feed cron route', () => {
  it('requires CRON_SECRET bearer auth', () => {
    const src = readFileSync(
      join(__dirname, '../../app/api/cron/attention-feed/route.ts'),
      'utf8',
    )
    assert.match(src, /CRON_SECRET/)
    assert.match(src, /Bearer/)
    assert.match(src, /runAttentionTick/)
  })

  it('registers vercel cron every 2 minutes', () => {
    const vercel = JSON.parse(
      readFileSync(join(__dirname, '../../vercel.json'), 'utf8'),
    ) as { crons: { path: string; schedule: string }[] }
    const hit = vercel.crons.find((c) => c.path === '/api/cron/attention-feed')
    assert.ok(hit)
    assert.equal(hit!.schedule, '*/2 * * * *')
  })

  it('SSE route does not invent filler events', () => {
    const src = readFileSync(
      join(__dirname, '../../app/api/terminal-os/attention/stream/route.ts'),
      'utf8',
    )
    assert.match(src, /event: snapshot|send\('snapshot'/)
    assert.match(src, /getAttentionSnapshot|runAttentionTick/)
    assert.ok(!/still checking|filler|fake activity/i.test(src))
  })
})
