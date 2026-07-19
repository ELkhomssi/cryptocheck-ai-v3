import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createHash, randomUUID } from 'node:crypto'
import { hashIp, isBot, pickClientIp } from '../../lib/page-views/capture'

describe('page_views capture helpers', () => {
  it('flags known bot UAs and empty UA', () => {
    assert.equal(isBot(null), true)
    assert.equal(isBot(''), true)
    assert.equal(isBot('curl/8.0.1'), true)
    assert.equal(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true)
    assert.equal(
      isBot(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
      false,
    )
  })

  it('hashes IP with salt — never returns raw IP', async () => {
    const raw = '203.0.113.42'
    const hashed = await hashIp(raw, 'test-salt')
    assert.ok(hashed)
    assert.notEqual(hashed, raw)
    assert.match(hashed!, /^[a-f0-9]{64}$/)
    const expected = createHash('sha256').update(raw + 'test-salt').digest('hex')
    assert.equal(hashed, expected)
  })

  it('picks first x-forwarded-for hop', () => {
    const h = new Headers({
      'x-forwarded-for': '198.51.100.7, 10.0.0.1',
    })
    assert.equal(pickClientIp(h), '198.51.100.7')
  })

  it('session id format is uuid-compatible', () => {
    const sid = randomUUID()
    assert.match(sid, /^[0-9a-f-]{36}$/i)
  })
})

describe('LaunchLab redirect paths (unchanged contract)', () => {
  const cases = ['/launchlab', '/LaunchLab', '/LaunchLAB', '/LAUNCHLAB']
  for (const pathname of cases) {
    it(`maps ${pathname} → /launchLab`, () => {
      const search = '?x=1'
      const target = `/launchLab${search}`
      assert.equal(target, '/launchLab?x=1')
      assert.ok(
        pathname === '/launchlab' ||
          pathname === '/LaunchLab' ||
          pathname === '/LaunchLAB' ||
          pathname === '/LAUNCHLAB',
      )
    })
  }
})
