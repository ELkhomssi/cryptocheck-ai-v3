/**
 * SENTINEL Engine — real-time batch scan smoke test (local or staging).
 *
 * Prerequisites:
 *   - `npm run dev` (or `npm start`) on TEST_BASE_URL
 *   - SENTINEL_API_KEY=cc_sentinel_... in .env (Pro/Enterprise; v2 keys only)
 *
 * Usage:
 *   npm run test:sentinel -- <PUMP_FUN_MINT>
 *   PUMP_FUN_MINT=... npm run test:sentinel
 */

import 'dotenv/config'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const API_KEY =
  process.env.SENTINEL_API_KEY || process.env.TEST_SENTINEL_API_KEY || ''

const JUP_MINT = 'JUPyiwrYJFv1mHSSge9dB8EjzzxZrMciSJAThvB6mZe'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

function utcDayStartIso(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

async function countApiUsageLogsToday(userId: string): Promise<number | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key)
  const { count, error } = await sb
    .from('security_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', 'api_usage')
    .gte('created_at', utcDayStartIso())

  if (error) {
    console.warn('[QUOTA CHECK] Supabase count failed:', error.message)
    return null
  }
  return count ?? 0
}

type PlatformResult = {
  score?: number
  decision?: string
  confidence?: number
  risk_assessment?: {
    rug_score: number
    liquidity_status: string
    mint_status: string
    insider_flag: boolean
  }
  risk_breakdown?: { liquidity: number; wallet: number; contract: number }
  wallet_intelligence?: Record<string, unknown>
  meta?: { tier?: string }
}

function printSecurityBlock(label: string, data: PlatformResult | undefined, ok: boolean) {
  console.log('')
  console.log(`  --- ${label} (${ok ? 'OK' : 'FAIL'}) ---`)
  if (!data) {
    console.log('  (no payload)')
    return
  }
  console.log(`  score: ${data.score ?? 'n/a'}  decision: ${data.decision ?? 'n/a'}  confidence: ${data.confidence ?? 'n/a'}`)
  const ra = data.risk_assessment
  if (ra) {
    console.log('  risk_assessment:')
    console.log(`    rug_score: ${ra.rug_score}`)
    console.log(`    liquidity_status: ${ra.liquidity_status}`)
    console.log(`    mint_status: ${ra.mint_status}`)
    console.log(`    insider_flag: ${ra.insider_flag}`)
  }
  if (data.risk_breakdown) {
    console.log(
      `  risk_breakdown: liquidity=${data.risk_breakdown.liquidity} wallet=${data.risk_breakdown.wallet} contract=${data.risk_breakdown.contract}`
    )
  }
  if (data.wallet_intelligence) {
    console.log(`  wallet_intelligence: ${JSON.stringify(data.wallet_intelligence)}`)
  }
}

async function main() {
  if (!API_KEY.startsWith('cc_sentinel_')) {
    console.error('Set SENTINEL_API_KEY (or TEST_SENTINEL_API_KEY) to a cc_sentinel_* key in .env')
    process.exit(1)
  }

  const pumpMint = (process.argv[2] || process.env.PUMP_FUN_MINT || '').trim()
  if (!pumpMint) {
    console.error('Provide a Pump.fun mint (CA):')
    console.error('  npm run test:sentinel -- <mint_address>')
    console.error('  or: PUMP_FUN_MINT=... npm run test:sentinel')
    process.exit(1)
  }

  const items = [
    { label: 'JUP (known legit)', tokenAddress: JUP_MINT, chain: 'solana' },
    { label: 'USDC (stablecoin)', tokenAddress: USDC_MINT, chain: 'solana' },
    { label: 'Pump.fun (manual CA)', tokenAddress: pumpMint, chain: 'solana' },
  ]

  const testUserId = process.env.TEST_USER_ID?.trim()
  let usageBefore: number | null = null
  if (testUserId) {
    usageBefore = await countApiUsageLogsToday(testUserId)
  }

  const url = `${BASE_URL.replace(/\/$/, '')}/api/v1/scan/batch`
  const body = {
    chain: 'solana',
    items: items.map((i) => ({ tokenAddress: i.tokenAddress, chain: i.chain })),
  }

  const t0 = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/vnd.cryptocheck.platform+json',
    },
    body: JSON.stringify(body),
  })
  const latencyMs = Date.now() - t0

  const tierHeader = res.headers.get('x-cryptocheck-sentinel-tier')
  const expectedTier = process.env.EXPECTED_SENTINEL_TIER?.trim()
  const tierOk = !expectedTier || tierHeader === expectedTier

  console.log('')
  console.log('========== SENTINEL Batch Scan Test ==========')
  console.log(`[ENDPOINT] ${url}`)
  console.log(`[HTTP] ${res.status} ${res.statusText}`)
  console.log('')
  console.log(
    `[TIER CHECK]: ${tierOk ? 'Success' : 'Fail'}  (header: ${tierHeader ?? 'n/a'}${expectedTier ? `, expected: ${expectedTier}` : ''})`
  )
  console.log(`[LATENCY]: ${latencyMs} ms (full batch request)`)

  const lim = res.headers.get('x-ratelimit-limit')
  const rem = res.headers.get('x-ratelimit-remaining')
  const reset = res.headers.get('x-ratelimit-reset')
  console.log('')
  console.log('[QUOTA CHECK]')
  console.log(
    '  Authoritative daily quota is enforced in Redis (not a Supabase `daily_quota` column). After this request, remaining is:'
  )
  console.log(`  X-RateLimit-Limit: ${lim ?? 'n/a'}`)
  console.log(`  X-RateLimit-Remaining: ${rem ?? 'n/a'} (after this batch; batch consumes N = items.length)`)
  console.log(`  X-RateLimit-Reset: ${reset ?? 'n/a'} (epoch ms, UTC day bucket)`)
  console.log(
    '  Supabase: optional audit — `security_logs` rows with action=api_usage should increase by +1 per successful batch.'
  )
  if (testUserId && usageBefore !== null) {
    const usageAfter = await countApiUsageLogsToday(testUserId)
    console.log(`  security_logs count (UTC today): before=${usageBefore} after=${usageAfter ?? 'n/a'}`)
    if (usageAfter !== null && usageAfter >= usageBefore) {
      const delta = usageAfter - usageBefore
      const ok = delta >= 1
      console.log(`  [SUPABASE AUDIT]: ${ok ? 'Success' : 'Fail'}  delta: +${delta} (expect +1 per batch)`)
    }
  } else if (!testUserId) {
    console.log('  (Set TEST_USER_ID + SUPABASE_SERVICE_ROLE_KEY to verify security_logs counts.)')
  }

  const json = (await res.json().catch(() => ({}))) as {
    batch_size?: number
    succeeded?: number
    failed?: number
    results?: Array<{ index: number; ok: boolean; data?: PlatformResult; error?: string; code?: number }>
    error?: string
  }

  console.log('')
  console.log('[SECURITY SCORE] (platform payload per item)')
  if (!res.ok) {
    console.log('  Request failed:', JSON.stringify(json, null, 2))
    process.exit(1)
  }

  const results = json.results || []
  for (let i = 0; i < items.length; i++) {
    const meta = items[i]
    const row = results.find((r) => r.index === i)
    const ok = row?.ok === true
    printSecurityBlock(meta.label, row?.data, ok)
    if (row && !row.ok) {
      console.log(`  error: ${row.error} code=${row.code}`)
    }
  }

  console.log('')
  console.log(`[SUMMARY] batch_size=${json.batch_size} succeeded=${json.succeeded} failed=${json.failed}`)
  console.log('==============================================')
  console.log('')

  if (!tierOk) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
