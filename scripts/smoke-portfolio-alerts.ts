/**
 * Portfolio + Watchlist + Alerts smoke tests.
 *
 * Prerequisites:
 *  - `npm run dev` (script auto-picks localhost:3000 or :3001, or set TEST_BASE_URL)
 *  - `.env.local`: CRON_SECRET (cron smoke), TELEGRAM_BOT_TOKEN (Telegram sends in Next)
 *  - Optional authenticated cookie for user-scoped routes:
 *      TEST_SESSION_COOKIE="sb-access-token=...; sb-refresh-token=..."
 *
 * Usage:
 *   npm run test:portfolio-alerts
 */

import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })
loadEnv()

const SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || ''
const CRON_SECRET = process.env.CRON_SECRET || ''

/** Next dev often binds to 3001 when 3000 is taken; probe cron route (401 without secret = server up). */
async function resolveBaseUrl(): Promise<string> {
  if (process.env.TEST_BASE_URL?.trim()) return process.env.TEST_BASE_URL.trim()
  for (const port of [3000, 3001]) {
    const origin = `http://localhost:${port}`
    try {
      const r = await fetch(`${origin}/api/cron/watchlist-scan`, {
        signal: AbortSignal.timeout(3000),
      })
      if (r.status === 401) return origin
    } catch {
      /* try next port */
    }
  }
  return 'http://localhost:3000'
}

let BASE_URL = 'http://localhost:3000'

function envSummary() {
  const cronLen = CRON_SECRET.trim().length
  const tgLen = (process.env.TELEGRAM_BOT_TOKEN || '').trim().length
  console.log(
    'Env (smoke runner): CRON_SECRET',
    cronLen ? `set (${cronLen} chars)` : 'missing',
    '| TELEGRAM_BOT_TOKEN',
    tgLen ? `set (${tgLen} chars)` : 'missing'
  )
  console.log(
    'Note: Cron + Telegram send run inside Next.js; ensure .env.local has CRON_SECRET and TELEGRAM_BOT_TOKEN for `npm run dev`.'
  )
}

const SAMPLE_WALLET = '5Q544fKrFoe6tsEbMhJxFcQSWvV7yqiQ8s5NEsP8pc6d'
const SAMPLE_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' // BONK

function authHeaders(): Record<string, string> {
  return SESSION_COOKIE ? { Cookie: SESSION_COOKIE } : {}
}

async function requestJson(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  }
  let body: string | undefined
  if (init?.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.json)
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body,
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json }
}

async function testPortfolioScan() {
  const result = await requestJson('/api/v1/portfolio/scan', {
    method: 'POST',
    headers: { ...authHeaders() },
    json: { walletAddress: SAMPLE_WALLET },
  })
  console.log('[Test 1] Portfolio scan:', result.status)
  if (result.status === 200) {
    const j = result.json as { summary?: { totalTokens?: number }; tier?: string }
    console.log('         tier:', j.tier ?? 'unknown', 'tokens:', j.summary?.totalTokens ?? 0)
  } else {
    console.log('         body:', JSON.stringify(result.json))
  }
}

async function testWatchlistLimit() {
  const before = await requestJson('/api/v1/watchlist', {
    method: 'GET',
    headers: { ...authHeaders() },
  })
  console.log('[Test 2] Watchlist GET:', before.status)
  if (before.status !== 200) {
    console.log('         body:', JSON.stringify(before.json))
    return
  }

  const add = await requestJson('/api/v1/watchlist', {
    method: 'POST',
    headers: { ...authHeaders() },
    json: { mint: SAMPLE_MINT, symbol: 'BONK' },
  })
  console.log('[Test 2] Watchlist ADD:', add.status)
  console.log('         body:', JSON.stringify(add.json))
}

function testTelegramLinkManual() {
  console.log('[Test 3] Telegram link flow: MANUAL')
  console.log('         Open /dashboard/alerts, click "Connect Telegram for alerts", then run /link code in @CryptoCheck_AI.')
}

async function testCronRoute() {
  if (!CRON_SECRET) {
    console.log('[Test 4] Cron route: SKIPPED (CRON_SECRET not set in .env / .env.local)')
    return
  }
  const cron = await requestJson('/api/cron/watchlist-scan', {
    method: 'GET',
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  console.log('[Test 4] Cron watchlist scan:', cron.status)
  const body = cron.json as {
    diagnostics?: { telegramBotTokenConfigured?: boolean }
    deliveryAttempts?: Array<{ userId: string; mint: string; channel: string; status: string }>
    watchlistSize?: number
    alertsTriggered?: number
    failures?: unknown[]
  }
  console.log('         body:', JSON.stringify(cron.json))
  if (cron.status === 200 && body.diagnostics) {
    console.log(
      '         Server diagnostics: TELEGRAM_BOT_TOKEN in Next process =',
      body.diagnostics.telegramBotTokenConfigured === true ? 'yes' : 'no'
    )
  }
  if (cron.status === 200 && Array.isArray(body.deliveryAttempts) && body.deliveryAttempts.length > 0) {
    console.log('')
    console.log('--- Delivery report (this cron run) ---')
    for (const row of body.deliveryAttempts) {
      console.log(
        `  ${row.status.toUpperCase()} | ${row.channel} | user ${row.userId.slice(0, 8)}… | mint ${row.mint.slice(0, 8)}…`
      )
    }
    console.log('----------------------------------------')
  } else if (cron.status === 200) {
    console.log('         No delivery attempts (no qualifying alerts or no linked channels).')
  }
}

async function main() {
  BASE_URL = await resolveBaseUrl()
  console.log('Portfolio+Alerts smoke tests —', BASE_URL)
  envSummary()
  if (!SESSION_COOKIE) {
    console.log('No TEST_SESSION_COOKIE provided. Auth-required routes are expected to return 401.')
  }
  console.log('')

  await testPortfolioScan()
  await testWatchlistLimit()
  testTelegramLinkManual()
  await testCronRoute()

  console.log('')
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
