/** Legitimate search / social crawlers — never challenge, rate-limit, or block. */
export const SEARCH_ENGINE_ALLOWLIST: RegExp[] = [
  /googlebot/i,
  /google-inspectiontool/i,
  /bingbot/i,
  /bingpreview/i,
  /applebot/i,
  /duckduckbot/i,
  /yandex(bot|images)/i,
  /baiduspider/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /slurp/i, // Yahoo
  /chrome-lighthouse/i,
  /google pagespeed/i,
  /ptst/i, // Catchpoint / monitoring often used with Lighthouse CI
]

/** AI scrapers — configurable allow / throttle / block. */
export const AI_SCRAPER_PATTERNS: RegExp[] = [
  /gptbot/i,
  /claudebot/i,
  /anthropic-ai/i,
  /bytespider/i,
  /ccbot/i,
  /amazonbot/i,
  /diffbot/i,
  /petalbot/i,
  /perplexitybot/i,
  /oai-searchbot/i,
  /meta-externalagent/i,
  /meta-externalfetcher/i,
  /chatgpt-user/i,
  /cohere-ai/i,
]

/** Headless / automation fingerprints in UA. */
export const HEADLESS_UA_PATTERNS: RegExp[] = [
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /webdriver/i,
  /puppeteer/i,
  /playwright/i,
  /scrapy/i,
  /httpclient/i,
  /java\//i,
  /libwww-perl/i,
  /go-http-client/i,
  /python-requests/i,
  /python-urllib/i,
  /aiohttp/i,
  /curl\//i,
  /wget\//i,
  /node-fetch/i,
  /axios\//i,
]

export function isSearchEngineCrawler(ua: string | null): boolean {
  if (!ua) return false
  return SEARCH_ENGINE_ALLOWLIST.some((re) => re.test(ua))
}

export function isAiScraper(ua: string | null): boolean {
  if (!ua) return false
  return AI_SCRAPER_PATTERNS.some((re) => re.test(ua))
}

export function isHeadlessUa(ua: string | null): boolean {
  if (!ua) return false
  return HEADLESS_UA_PATTERNS.some((re) => re.test(ua))
}
