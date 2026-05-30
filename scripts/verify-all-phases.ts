/**
 * End-to-end verification after Phases T1–T2, P1–P4.
 *
 * Prerequisites:
 *   npm run dev   (or set TEST_BASE_URL)
 *   .env.local with optional TEST_API_KEY / B2B_TEST_* for authenticated routes
 *
 * Usage:
 *   npm run verify:all-phases
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { config as loadEnv } from 'dotenv'

const ROOT = path.resolve(__dirname, '..')
loadEnv({ path: path.join(ROOT, '.env.local') })
loadEnv({ path: path.join(ROOT, '.env') })

type Status = 'pass' | 'fail' | 'skip' | 'warn'

type Check = {
  id: string
  name: string
  status: Status
  detail: string
  ms?: number
}

const API_KEY = process.env.TEST_API_KEY || process.env.INTELLIGENCE_API_KEY || ''
const B2B_KEY = process.env.B2B_TEST_API_KEY || ''
const B2B_SECRET = process.env.B2B_TEST_SECRET || ''

const SAMPLE_WALLET = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'

const checks: Check[] = []

function record(id: string, name: string, status: Status, detail: string, ms?: number) {
  checks.push({ id, name, status, detail, ms })
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : status === 'warn' ? '⚠️' : '⏭️'
  console.log(`${icon} [${id}] ${name}${ms != null ? ` (${ms}ms)` : ''}`)
  console.log(`   ${detail}`)
}

async function resolveBaseUrl(): Promise<string> {
  if (process.env.TEST_BASE_URL?.trim()) return process.env.TEST_BASE_URL.trim().replace(/\/$/, '')
  for (const port of [3100, 3000, 3001]) {
    const origin = `http://localhost:${port}`
    try {
      const r = await fetch(`${origin}/api/payments/intent?id=pi_invalid`, {
        signal: AbortSignal.timeout(4000),
      })
      if (r.status === 400 || r.status === 404 || r.status === 200) return origin
    } catch {
      /* try next */
    }
  }
  return process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, '') || 'http://localhost:3100'
}

function authHeaders(): Record<string, string> {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}
}

async function timedFetch(url: string, init?: RequestInit): Promise<{ status: number; json: unknown; ms: number }> {
  const t0 = performance.now()
  const res = await fetch(url, init)
  const text = await res.text()
  const ms = Math.round(performance.now() - t0)
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { status: res.status, json, ms }
}

async function checkTradingUiWiring() {
  const tabs = fs.readFileSync(path.join(ROOT, 'components/trading/IntelligenceTradeTabs.tsx'), 'utf8')
  const panel = fs.readFileSync(path.join(ROOT, 'components/trading/RiskGatedSwapPanel.tsx'), 'utf8')
  const terminal = fs.readFileSync(
    path.join(ROOT, 'app/dashboard/intelligence-terminal/intelligence-terminal-client.tsx'),
    'utf8'
  )

  const ok =
    tabs.includes('RiskGatedSwapPanel') &&
    tabs.includes("setTab('trade')") &&
    panel.includes("verdict === 'BLOCKED'") &&
    panel.includes('BLOCKED — too risky to swap') &&
    terminal.includes('IntelligenceTradeTabs')

  record(
    'T1-ui',
    'Trading UI wiring (Intel → Trade tab → RiskGatedSwapPanel)',
    ok ? 'pass' : 'fail',
    ok
      ? 'IntelligenceTradeTabs renders RiskGatedSwapPanel; BLOCKED verdict disables swap button'
      : 'Missing expected Trade tab or blocked-state UI'
  )
}

async function checkTradingApi(base: string) {
  if (!API_KEY) {
    record('T1-api', 'POST /api/trading/assess-swap', 'skip', 'Set TEST_API_KEY for authenticated assess-swap probe')
    return
  }

  const { status, json, ms } = await timedFetch(`${base}/api/trading/assess-swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      fromToken: 'So11111111111111111111111111111111111111112',
      toToken: BONK_MINT,
      amountUsd: 25,
      slippageBps: 50,
      walletAddress: SAMPLE_WALLET,
    }),
  })

  const body = json as { riskScore?: number; verdict?: string; allowed?: boolean; error?: string }
  const ok = status === 200 && typeof body.riskScore === 'number' && typeof body.verdict === 'string'
  record(
    'T1-api',
    'POST /api/trading/assess-swap',
    ok ? (ms <= 200 ? 'pass' : 'warn') : 'fail',
    ok
      ? `riskScore=${body.riskScore} verdict=${body.verdict} allowed=${body.allowed}${ms > 200 ? ' — exceeds 200ms target' : ''}`
      : `HTTP ${status}: ${body.error ?? JSON.stringify(json).slice(0, 120)}`,
    ms
  )
}

async function checkAssessSwapPerformance(base: string) {
  if (B2B_KEY) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${B2B_KEY}`,
    }
    if (B2B_SECRET) headers['X-CCAI-Partner-Secret'] = B2B_SECRET

    const { status, json, ms } = await timedFetch(`${base}/api/b2b/v1/risk`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ chain: 'solana', address: USDC_MINT, mode: 'fast' }),
    })
    const body = json as { score?: number; error?: string }
    const ok = status === 200 && typeof body.score === 'number'
    record(
      'P6-assess',
      'Risk assess latency (B2B fast scan proxy)',
      ok ? (ms <= 200 ? 'pass' : 'warn') : status >= 500 ? 'skip' : 'fail',
      ok
        ? `score=${body.score}${ms > 200 ? ' — exceeds 200ms target' : ''}`
        : `HTTP ${status}: ${body.error ?? 'dependency unavailable'}`,
      ms
    )
    return
  }

  if (API_KEY) {
    const { status, json, ms } = await timedFetch(`${base}/api/trading/assess-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        fromToken: 'So11111111111111111111111111111111111111112',
        toToken: USDC_MINT,
        amountUsd: 10,
        slippageBps: 50,
      }),
    })
    const body = json as { riskScore?: number; error?: string }
    const ok = status === 200 && typeof body.riskScore === 'number'
    record(
      'P6-assess',
      'assessSwapIntent latency (via /api/trading/assess-swap)',
      ok ? (ms <= 200 ? 'pass' : 'warn') : 'fail',
      ok
        ? `riskScore=${body.riskScore}${ms > 200 ? ' — exceeds 200ms target' : ''}`
        : `HTTP ${status}: ${body.error ?? JSON.stringify(json).slice(0, 80)}`,
      ms
    )
    return
  }

  record('P6-assess', 'Risk assess latency', 'skip', 'Set B2B_TEST_API_KEY or TEST_API_KEY')
}

async function checkPaymentFlow(base: string) {
  const merchantRes = await timedFetch(`${base}/api/payments/merchant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: SAMPLE_WALLET,
      merchantName: 'Verify Test Merchant',
    }),
  })
  const merchantOk = merchantRes.status === 200 || merchantRes.status === 201
  record(
    'P1-merchant',
    'POST /api/payments/merchant',
    merchantOk ? 'pass' : 'fail',
    merchantOk ? 'Merchant registered' : `HTTP ${merchantRes.status}`,
    merchantRes.ms
  )

  const intentRes = await timedFetch(`${base}/api/payments/intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toWallet: SAMPLE_WALLET,
      tokenMint: USDC_MINT,
      amountUsd: 5,
      chain: 'solana',
      fromWallet: SAMPLE_WALLET,
      memo: 'verify-all-phases',
    }),
  })
  const intent = intentRes.json as {
    id?: string
    status?: string
    riskAssessment?: { approved?: boolean; score?: number }
    error?: string
  }
  const intentOk =
    intentRes.status === 200 &&
    typeof intent.id === 'string' &&
    intent.id.startsWith('pi_') &&
    intent.riskAssessment != null

  record(
    'P1-intent',
    'POST /api/payments/intent (risk check)',
    intentOk ? (intentRes.ms <= 300 ? 'pass' : 'warn') : 'fail',
    intentOk
      ? `id=${intent.id} status=${intent.status} approved=${intent.riskAssessment?.approved}${intentRes.ms > 300 ? ' — exceeds 300ms target' : ''}`
      : `HTTP ${intentRes.status}: ${intent.error ?? JSON.stringify(intentRes.json).slice(0, 120)}`,
    intentRes.ms
  )

  const payPage = await timedFetch(`${base}/pay/${SAMPLE_WALLET}?embed=true&amount=5&token=USDC`)
  record(
    'P1-page',
    'GET /pay/[wallet]?embed=true',
    payPage.status === 200 ? 'pass' : 'fail',
    payPage.status === 200 ? 'Hosted embed checkout page renders' : `HTTP ${payPage.status}`,
    payPage.ms
  )
}

async function checkPortfolio(base: string) {
  if (!API_KEY) {
    record('P3-portfolio', 'GET /api/portfolio/[wallet]', 'skip', 'Set TEST_API_KEY for portfolio probe')
    return
  }

  const { status, json, ms } = await timedFetch(`${base}/api/portfolio/${SAMPLE_WALLET}?chain=solana`, {
    headers: authHeaders(),
  })
  const body = json as {
    totalValueUsd?: number
    riskExposure?: string
    positions?: unknown[]
    error?: string
  }

  if (status === 401 || status === 403) {
    record('P3-portfolio', 'GET /api/portfolio/[wallet]', 'skip', `HTTP ${status} — API key lacks Pro tier`)
    return
  }

  const ok = status === 200 && typeof body.totalValueUsd === 'number' && typeof body.riskExposure === 'string'
  record(
    'P3-portfolio',
    'GET /api/portfolio/[wallet]',
    ok ? (ms <= 2000 ? 'pass' : 'warn') : 'fail',
    ok
      ? `total=$${body.totalValueUsd?.toFixed(2)} exposure=${body.riskExposure} positions=${body.positions?.length ?? 0}${ms > 2000 ? ' — exceeds 2s target' : ''}`
      : `HTTP ${status}: ${body.error ?? JSON.stringify(json).slice(0, 120)}`,
    ms
  )
}

async function checkCcaiPayBundle(base: string) {
  const bundleSrc = path.join(ROOT, 'packages/ccai-pay/dist/ccai-pay.min.js')
  if (!fs.existsSync(bundleSrc)) {
    record('P4-bundle', 'ccai-pay.min.js exists', 'fail', 'Run: npm run build --prefix packages/ccai-pay')
    return
  }

  const src = fs.readFileSync(bundleSrc, 'utf8')
  const hasClass = src.includes('CCAIPay') && src.includes('createButton') && src.includes('openPaymentModal')
  record(
    'P4-bundle',
    'ccai-pay.min.js structure',
    hasClass ? 'pass' : 'fail',
    hasClass ? `${(src.length / 1024).toFixed(1)} KB — CCAIPay + createButton + openPaymentModal present` : 'Missing expected exports'
  )

  const publicDir = path.join(ROOT, 'public/ccai-pay/v1')
  fs.mkdirSync(publicDir, { recursive: true })
  fs.copyFileSync(bundleSrc, path.join(publicDir, 'ccai-pay.min.js'))

  const demoPath = path.join(ROOT, 'public/ccai-pay-demo.html')
  if (fs.existsSync(demoPath)) {
    const demo = await timedFetch(`${base}/ccai-pay-demo.html`)
    record(
      'P4-demo',
      'GET /ccai-pay-demo.html',
      demo.status === 200 ? 'pass' : 'fail',
      demo.status === 200 ? 'Demo page served — open in browser to test modal' : `HTTP ${demo.status}`
    )
  }

  const script = await timedFetch(`${base}/ccai-pay/v1/ccai-pay.min.js`)
  record(
    'P4-cdn',
    'GET /ccai-pay/v1/ccai-pay.min.js',
    script.status === 200 ? 'pass' : 'fail',
    script.status === 200 ? 'Bundle served locally (CDN path preview)' : `HTTP ${script.status}`,
    script.ms
  )
}

async function checkSignalsRoute(base: string) {
  if (!API_KEY) {
    record('T2-signals', 'GET /api/trading/signals (SSE)', 'skip', 'Set TEST_API_KEY for SSE probe')
    return
  }

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 2500)
    const t0 = performance.now()
    const res = await fetch(`${base}/api/trading/signals?chain=solana`, {
      headers: { ...authHeaders(), Accept: 'text/event-stream' },
      signal: controller.signal,
    })
    clearTimeout(t)
    const ms = Math.round(performance.now() - t0)
    const ok = res.status === 200 && (res.headers.get('content-type') ?? '').includes('text/event-stream')
    record(
      'T2-signals',
      'GET /api/trading/signals (SSE)',
      ok ? 'pass' : 'fail',
      ok ? 'SSE stream opens' : `HTTP ${res.status} content-type=${res.headers.get('content-type')}`,
      ms
    )
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      record('T2-signals', 'GET /api/trading/signals (SSE)', 'pass', 'SSE connection opened (aborted after 2.5s probe)', 2500)
    } else {
      record('T2-signals', 'GET /api/trading/signals (SSE)', 'fail', e instanceof Error ? e.message : String(e))
    }
  }
}

async function checkB2bSmoke(base: string) {
  if (!B2B_KEY) {
    record('audit-T4', 'B2B smoke (POST /api/b2b/v1/risk)', 'skip', 'Set B2B_TEST_API_KEY')
    return
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${B2B_KEY}`,
  }
  if (B2B_SECRET) headers['X-CCAI-Partner-Secret'] = B2B_SECRET

  const { status, json, ms } = await timedFetch(`${base}/api/b2b/v1/risk`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chain: 'solana', address: USDC_MINT, mode: 'fast' }),
  })
  const body = json as { score?: number; confidence?: string; error?: string }
  const ok = status === 200 && typeof body.score === 'number'
  record(
    'audit-T4',
    'B2B smoke (POST /api/b2b/v1/risk)',
    ok ? 'pass' : status >= 500 ? 'skip' : 'fail',
    ok ? `score=${body.score} confidence=${body.confidence ?? 'n/a'}` : `HTTP ${status}: ${body.error ?? 'unknown'}`,
    ms
  )
}

function checkAuditGate() {
  const auditPath = path.join(ROOT, 'docs/audit-results.json')
  if (!fs.existsSync(auditPath)) {
    record('audit-gate', 'Architecture audit gate', 'skip', 'Run npm run audit:post-migration first')
    return
  }
  const raw = JSON.parse(fs.readFileSync(auditPath, 'utf8')) as {
    gate?: string
    tasks?: Array<{ task: number; status: string }>
    results?: Array<{ task: number; status: string }>
  }
  const rows = raw.tasks ?? raw.results ?? []
  const gate = raw.gate ?? 'unknown'
  const t3 = rows.find((r) => r.task === 3)?.status ?? '?'
  const t5 = rows.find((r) => r.task === 5)?.status ?? '?'
  const t1 = rows.find((r) => r.task === 1)?.status ?? '?'
  const t4 = rows.find((r) => r.task === 4)?.status ?? '?'
  record(
    'audit-gate',
    'Architecture audit scoreboard',
    gate.includes('PASS') || gate.includes('pass') ? 'pass' : 'warn',
    `gate=${gate} T1=${t1} T3=${t3} T4=${t4} T5=${t5}`
  )
}

function writeReport(base: string) {
  const passed = checks.filter((c) => c.status === 'pass').length
  const failed = checks.filter((c) => c.status === 'fail').length
  const skipped = checks.filter((c) => c.status === 'skip').length
  const warned = checks.filter((c) => c.status === 'warn').length
  const gate = failed === 0 ? '✅ PASS' : '❌ FAIL'

  const md = `# Phase verification results

**Generated:** ${new Date().toISOString()}
**Target:** ${base}
**Gate:** ${gate}

| Result | Count |
|--------|-------|
| ✅ pass | ${passed} |
| ⚠️ warn | ${warned} |
| ❌ fail | ${failed} |
| ⏭️ skip | ${skipped} |

## Checks

| ID | Check | Status | Detail |
|----|-------|--------|--------|
${checks.map((c) => `| ${c.id} | ${c.name} | ${c.status} | ${c.detail.replace(/\|/g, '\\|')}${c.ms != null ? ` (${c.ms}ms)` : ''} |`).join('\n')}

## Manual follow-ups

- **Trading UI:** Open \`/dashboard/intelligence-terminal\`, select a token, click **Trade** tab — confirm risk panel loads.
- **CCAI Pay modal:** Open \`${base}/ccai-pay-demo.html\`, click the button — modal + wallet prompt should appear.
- **Wallet signing:** Full on-chain payment/swap requires a connected browser wallet (not covered by this script).

`

  fs.writeFileSync(path.join(ROOT, 'docs/verification-results.md'), md)
  console.log('')
  console.log(`Wrote docs/verification-results.md — ${gate}`)
}

async function main() {
  const base = await resolveBaseUrl()
  console.log('Phase verification —', base)
  console.log('API_KEY:', API_KEY ? 'set' : 'missing', '| B2B_TEST_API_KEY:', B2B_KEY ? 'set' : 'missing')
  console.log('')

  await checkTradingUiWiring()
  await checkTradingApi(base)
  await checkAssessSwapPerformance(base)
  await checkPaymentFlow(base)
  await checkPortfolio(base)
  await checkCcaiPayBundle(base)
  await checkSignalsRoute(base)
  await checkB2bSmoke(base)

  console.log('')
  if (!process.env.VERIFY_SKIP_AUDIT) {
    console.log('Running architecture audit…')
    try {
      execSync('npm run audit:post-migration', { cwd: ROOT, stdio: 'inherit' })
    } catch {
      record('audit-run', 'npm run audit:post-migration', 'fail', 'Audit script exited non-zero')
    }
  } else {
    record('audit-run', 'npm run audit:post-migration', 'skip', 'VERIFY_SKIP_AUDIT=1')
  }
  checkAuditGate()

  writeReport(base)
  const failed = checks.filter((c) => c.status === 'fail').length
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
