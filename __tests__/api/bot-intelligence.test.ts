import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('bot intelligence API route', () => {
  it('exists as operator-gated internal route', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/internal/bot-intelligence/route.ts'), 'utf8')
    assert.match(src, /getBotIntelligenceSnapshot/)
    assert.match(src, /isOperatorUser/)
    assert.match(src, /CRON_SECRET/)
  })
})

describe('robots + root metadata wiring', () => {
  it('robots.ts disallows private surfaces and points at sitemap', () => {
    const src = readFileSync(join(process.cwd(), 'app/robots.ts'), 'utf8')
    assert.match(src, /\/api\//)
    assert.match(src, /\/admin\//)
    assert.match(src, /\/auth\//)
    assert.match(src, /sitemap\.xml/)
  })

  it('root layout uses buildRootMetadata with verification hook', () => {
    const layout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')
    assert.match(layout, /buildRootMetadata/)
    const meta = readFileSync(join(process.cwd(), 'lib/seo/metadata.ts'), 'utf8')
    assert.match(meta, /GOOGLE_SITE_VERIFICATION/)
    assert.match(meta, /verification/)
    assert.doesNotMatch(meta, /zdQBBLwjabNtgA5Z/)
  })
})
