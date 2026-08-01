import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderSitemapIndex, renderUrlSet } from '../../lib/seo/sitemap-xml'
import { STATIC_SITEMAP_ROUTES } from '../../lib/seo/static-routes'
import { serializeJsonLd, homeJsonLd, tokenJsonLd, walletJsonLd, reportJsonLd } from '../../lib/seo/json-ld'
import { computeBotScore, DEFAULT_BOT_CONFIG } from '../../lib/bot-protection/score'
import { isSearchEngineCrawler, isAiScraper } from '../../lib/bot-protection/allowlists'

describe('sitemap XML', () => {
  it('renders urlset with loc lastmod changefreq priority', () => {
    const xml = renderUrlSet([
      {
        locPath: '/',
        lastmod: '2026-08-01T12:00:00.000Z',
        changefreq: 'daily',
        priority: 1,
      },
    ])
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
    assert.match(xml, /<loc>https:\/\/www\.cryptocheckai\.com\/<\/loc>/)
    assert.match(xml, /<lastmod>2026-08-01<\/lastmod>/)
    assert.match(xml, /<changefreq>daily<\/changefreq>/)
    assert.match(xml, /<priority>1\.0<\/priority>/)
  })

  it('renders sitemap index for child files', () => {
    const xml = renderSitemapIndex([
      { locPath: '/sitemap-static.xml', lastmod: '2026-08-01T00:00:00.000Z' },
      { locPath: '/sitemap-tokens.xml' },
    ])
    assert.match(xml, /<sitemapindex /)
    assert.match(xml, /sitemap-static\.xml/)
    assert.match(xml, /sitemap-tokens\.xml/)
  })

  it('includes all required static marketing routes', () => {
    const paths = new Set(STATIC_SITEMAP_ROUTES.map((r) => r.path))
    for (const required of [
      '/',
      '/terminalOS',
      '/execution',
      '/discovery',
      '/scanner',
      '/market-intel',
      '/portfolio',
      '/ai-coach',
      '/trade-like-me',
      '/security',
      '/pricing',
      '/about',
      '/contact',
      '/docs',
    ]) {
      assert.ok(paths.has(required), `missing ${required}`)
    }
    assert.equal(STATIC_SITEMAP_ROUTES.find((r) => r.path === '/')?.priority, 1)
    assert.equal(STATIC_SITEMAP_ROUTES.find((r) => r.path === '/terminalOS')?.priority, 0.95)
  })
})

describe('JSON-LD', () => {
  it('homepage includes Organization WebSite SoftwareApplication SearchAction', () => {
    const raw = serializeJsonLd(homeJsonLd())
    assert.match(raw, /SoftwareApplication/)
    assert.match(raw, /Organization/)
    assert.match(raw, /WebSite/)
    assert.match(raw, /SearchAction/)
    assert.ok(!raw.includes('<'), 'must escape < for script safety')
  })

  it('token/wallet/report builders emit expected @types', () => {
    assert.match(
      serializeJsonLd(
        tokenJsonLd({
          mint: 'So11111111111111111111111111111111111111112',
          name: 'Wrapped SOL',
          symbol: 'SOL',
          description: 'test',
          verdict: 'SAFE',
          safetyScore: 90,
        }),
      ),
      /"@type":"Article"/,
    )
    assert.match(
      serializeJsonLd(
        walletJsonLd({
          address: 'So11111111111111111111111111111111111111112',
          description: 'test',
        }),
      ),
      /ProfilePage/,
    )
    assert.match(
      serializeJsonLd(
        reportJsonLd({
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Daily Report',
          description: 'body',
          createdAt: '2026-08-01T00:00:00.000Z',
        }),
      ),
      /"@type":"Report"/,
    )
  })
})

describe('bot protection allowlist + score', () => {
  it('never scores Googlebot / Bingbot as malicious', () => {
    assert.equal(
      isSearchEngineCrawler('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
      true,
    )
    assert.equal(isSearchEngineCrawler('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'), true)
    const r = computeBotScore(
      {
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        missingBrowserHeaders: true,
        headerAnomalyScore: 50,
        tier: 'anonymous',
        path: '/',
        hasApiCredentials: false,
        requestsLastMinute: 10_000,
      },
      DEFAULT_BOT_CONFIG,
    )
    assert.equal(r.decision, 'allow')
    assert.equal(r.botScore, 0)
    assert.equal(r.crawlerAllowlisted, true)
  })

  it('detects AI scrapers and headless automation', () => {
    assert.equal(isAiScraper('GPTBot'), true)
    assert.equal(isAiScraper('ClaudeBot'), true)
    const r = computeBotScore(
      {
        userAgent: 'HeadlessChrome Selenium Puppeteer',
        missingBrowserHeaders: true,
        headerAnomalyScore: 20,
        tier: 'anonymous',
        path: '/pricing',
        hasApiCredentials: false,
        requestsLastMinute: 200,
      },
      DEFAULT_BOT_CONFIG,
    )
    assert.ok(r.botScore >= 55)
    assert.notEqual(r.decision, 'allow')
  })

  it('caps premium users below hard block unless blacklisted', () => {
    const r = computeBotScore(
      {
        userAgent: 'Mozilla/5.0',
        missingBrowserHeaders: true,
        headerAnomalyScore: 20,
        tier: 'premium',
        path: '/terminalOS',
        hasApiCredentials: false,
        requestsLastMinute: 500,
      },
      DEFAULT_BOT_CONFIG,
    )
    assert.ok(r.botScore < DEFAULT_BOT_CONFIG.stage4Min)
  })
})
