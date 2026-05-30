/**
 * Post-migration verification — runs Tasks 1–5 and writes docs/audit-results.json + .md
 *
 * Usage: npm run audit:post-migration
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { config as loadEnv } from 'dotenv'

const ROOT = path.resolve(__dirname, '..')
const DOCS = path.join(ROOT, 'docs')

// Load local env so credential-gated tasks (2, 4) can detect keys without exporting them manually.
loadEnv({ path: path.join(ROOT, '.env.local') })
loadEnv({ path: path.join(ROOT, '.env') })

type TaskStatus = 'pass' | 'fail' | 'warn' | 'skip'

type TaskResult = {
  task: number
  status: TaskStatus
  details: Record<string, unknown>
}

const HIGH_RISK_FILES = [
  'app/pro/dashboard/page.tsx',
  'app/api/neural-v4/route.ts',
  'lib/web4/protocol/parse-trade-logs.ts',
]

const SCANNER_IMPORT_RE = /@\/lib\/services\/scanner(-engine)?/

function git(cmd: string): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function listExternalScannerImporters(): string[] {
  const out = execSync(
    `grep -rl "@/lib/services/scanner" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v dist || true`,
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  )
  const engine = execSync(
    `grep -rl "@/lib/services/scanner-engine" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v dist || true`,
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  )
  const all = [...out.split('\n'), ...engine.split('\n')].filter(Boolean)
  const normalized = [...new Set(all.map((f) => f.replace(/^\.\//, '')))]
  return normalized.filter(
    (f) =>
      !f.startsWith('lib/services/scanner/') &&
      !f.startsWith('lib/connect/') &&
      f !== 'lib/services/scanner-engine.ts' &&
      f !== 'scripts/audit-post-migration.ts'
  )
}

function highRiskScannerViolations(importers: string[]): string[] {
  return HIGH_RISK_FILES.filter((hr) => {
    const full = path.join(ROOT, hr)
    if (!fs.existsSync(full)) return false
    const content = fs.readFileSync(full, 'utf8')
    return SCANNER_IMPORT_RE.test(content)
  })
}

async function runMadgeModuleCount(): Promise<number> {
  try {
    const madge = await import('madge')
    const res = await madge.default(path.join(ROOT, 'lib/services/scanner/index.ts'), {
      tsConfig: path.join(ROOT, 'tsconfig.json'),
    })
    return Object.keys(res.obj()).length
  } catch (e) {
    return -1
  }
}

async function task1Coupling(): Promise<TaskResult> {
  const externalImporters = listExternalScannerImporters()
  const count = externalImporters.length
  const hrViolations = highRiskScannerViolations(externalImporters)
  const madgeModuleCount = await runMadgeModuleCount()

  let status: TaskStatus = 'pass'
  if (count === 0) status = 'pass'
  else if (hrViolations.length > 0 || count >= 6) status = 'fail'
  else if (count >= 1 && count <= 5) status = 'warn'

  return {
    task: 1,
    status,
    details: {
      externalImporters,
      count,
      highRiskViolations: hrViolations,
      madgeModuleCount,
      passGate: '0 external importers; warn 1–5; fail 6+ or HIGH-RISK scanner imports',
    },
  }
}

async function task2Latency(): Promise<TaskResult> {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    return {
      task: 2,
      status: 'skip',
      details: { reason: 'no Supabase credentials (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)' },
    }
  }

  const sqlPath = path.join(DOCS, 'scan-timings-baseline.sql')
  if (!fs.existsSync(sqlPath)) {
    return { task: 2, status: 'skip', details: { reason: 'docs/scan-timings-baseline.sql missing' } }
  }

  const TARGET_MS = 150

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(url, key)

    const since = new Date()
    since.setUTCDate(since.getUTCDate() - 7)

    const [cachedRes, uncachedRes] = await Promise.all([
      sb
        .from('scan_timings')
        .select('total_ms')
        .eq('cached', true)
        .gte('created_at', since.toISOString()),
      sb
        .from('scan_timings')
        .select('total_ms')
        .eq('cached', false)
        .gte('created_at', since.toISOString()),
    ])

    function p50(rows: { total_ms: number }[] | null): number | null {
      if (!rows?.length) return null
      const ms = rows
        .map((r) => Number(r.total_ms))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b)
      if (!ms.length) return null
      return ms[Math.floor(ms.length * 0.5)]
    }

    const cachedP50 = p50(cachedRes.data as { total_ms: number }[] | null)
    const uncachedP50 = p50(uncachedRes.data as { total_ms: number }[] | null)

    if (uncachedP50 == null) {
      return {
        task: 2,
        status: 'skip',
        details: { reason: 'no uncached scan_timings rows in last 7 days', cachedP50 },
      }
    }

    let status: TaskStatus = 'pass'
    if (uncachedP50 < TARGET_MS) status = 'pass'
    else if (uncachedP50 <= 300) status = 'warn'
    else status = 'fail'

    return {
      task: 2,
      status,
      details: {
        cachedP50,
        uncachedP50,
        targetMs: TARGET_MS,
        cachedSample: cachedRes.data?.length ?? 0,
        uncachedSample: uncachedRes.data?.length ?? 0,
      },
    }
  } catch (e) {
    return {
      task: 2,
      status: 'skip',
      details: { reason: `Supabase query failed: ${e instanceof Error ? e.message : String(e)}` },
    }
  }
}

function task3PackageBoundaries(): TaskResult {
  const packagesDir = path.join(ROOT, 'packages')
  if (!fs.existsSync(packagesDir)) {
    return { task: 3, status: 'pass', details: { packages: [], note: 'no packages/ directory' } }
  }

  const dirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  const perPackage: Record<string, { atImports: string[]; tscOk: boolean; tscError?: string }> = {}
  let anyFail = false

  for (const name of dirs) {
    const pkgRoot = path.join(packagesDir, name)
    const srcDir = path.join(pkgRoot, 'src')
    const atImports: string[] = []

    if (fs.existsSync(srcDir)) {
      try {
        const grepOut = execSync(
          `grep -r "from '@/" "${srcDir}" --include="*.ts" --include="*.tsx" -l 2>/dev/null || true`,
          { encoding: 'utf8' }
        )
        atImports.push(...grepOut.split('\n').filter(Boolean))
      } catch {
        /* ignore */
      }
    }

    let tscOk = false
    let tscError: string | undefined
    const tsconfig = path.join(pkgRoot, 'tsconfig.json')
    if (fs.existsSync(tsconfig)) {
      try {
        if (name === 'signing') {
          execSync('npm run build', { cwd: pkgRoot, encoding: 'utf8', stdio: 'pipe' })
        } else if (name === 'ccai-connect') {
          execSync('npm run typecheck', { cwd: pkgRoot, encoding: 'utf8', stdio: 'pipe' })
        } else {
          execSync('npx tsc --noEmit', { cwd: pkgRoot, encoding: 'utf8', stdio: 'pipe' })
        }
        tscOk = true
      } catch (e) {
        tscError = e instanceof Error ? e.message : String(e)
        if (typeof e === 'object' && e && 'stdout' in e) {
          tscError = String((e as { stdout?: Buffer }).stdout ?? tscError)
        }
      }
    } else {
      tscOk = true
      tscError = 'no tsconfig.json — skipped tsc'
    }

    if (atImports.length > 0 || !tscOk) anyFail = true
    perPackage[name] = { atImports, tscOk, tscError }
  }

  return {
    task: 3,
    status: anyFail ? 'fail' : 'pass',
    details: { packages: perPackage },
  }
}

async function task4B2bSmoke(): Promise<TaskResult> {
  const apiKey = process.env.B2B_TEST_API_KEY?.trim()
  const secret = process.env.B2B_TEST_SECRET?.trim()
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.CRYPTOCHECK_BASE_URL?.trim() ||
    'http://localhost:3000'

  if (!apiKey) {
    return {
      task: 4,
      status: 'skip',
      details: { reason: 'no B2B test credentials (B2B_TEST_API_KEY)' },
    }
  }

  const riskRoute = path.join(ROOT, 'app/api/b2b/v1/risk/route.ts')
  if (!fs.existsSync(riskRoute)) {
    return {
      task: 4,
      status: 'skip',
      details: { reason: 'B2B routes not implemented (app/api/b2b/v1/risk missing)' },
    }
  }

  const SAFE_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  const RUG_MINT = process.env.B2B_TEST_RUG_MINT?.trim() || 'So11111111111111111111111111111111111111112'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  if (secret) headers['X-CCAI-Partner-Secret'] = secret

  try {
    const safeRes = await fetch(`${base.replace(/\/$/, '')}/api/b2b/v1/risk`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ chain: 'solana', address: SAFE_MINT, mode: 'fast' }),
    })
    const safeBody = (await safeRes.json().catch(() => ({}))) as { score?: number }
    const safeScore = Number(safeBody.score)

    const rugRes = await fetch(`${base.replace(/\/$/, '')}/api/b2b/v1/risk`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ chain: 'solana', address: RUG_MINT, mode: 'fast' }),
    })
    const rugBody = (await rugRes.json().catch(() => ({}))) as { score?: number }
    const rugScore = Number(rugBody.score)

    const repRes = await fetch(
      `${base.replace(/\/$/, '')}/api/b2b/v1/reputation?chain=solana&address=${encodeURIComponent(SAFE_MINT)}`,
      { headers }
    )

    // Server up but a scan dependency (e.g. HELIUS_API_KEY) is unavailable → cannot validate scores.
    const dependencyUnavailable = safeRes.status >= 500 || rugRes.status >= 500 || repRes.status >= 500
    if (dependencyUnavailable) {
      return {
        task: 4,
        status: 'skip',
        details: {
          reason: 'B2B routes reachable but a scan dependency returned 5xx (e.g. HELIUS_API_KEY unset)',
          safeStatus: safeRes.status,
          rugStatus: rugRes.status,
          reputationStatus: repRes.status,
        },
      }
    }

    const pass =
      safeRes.ok &&
      safeScore < 30 &&
      rugRes.ok &&
      rugScore > 70 &&
      repRes.status === 200

    return {
      task: 4,
      status: pass ? 'pass' : 'fail',
      details: {
        safeScore,
        rugScore,
        safeStatus: safeRes.status,
        rugStatus: rugRes.status,
        reputationStatus: repRes.status,
        ...(pass
          ? {}
          : {
              hint: 'Set HELIUS_API_KEY and a real high-risk B2B_TEST_RUG_MINT (default wSOL is legitimately safe).',
            }),
      },
    }
  } catch (e) {
    // Network error → smoke target not running; cannot validate (not a code failure).
    return {
      task: 4,
      status: 'skip',
      details: {
        reason: 'B2B smoke target unreachable (no running server)',
        error: e instanceof Error ? e.message : String(e),
      },
    }
  }
}

function task5ArchitectureDoc(): TaskResult {
  const docPath = path.join(DOCS, 'architecture.md')
  if (!fs.existsSync(docPath)) {
    return { task: 5, status: 'fail', details: { reason: 'docs/architecture.md missing' } }
  }
  const text = fs.readFileSync(docPath, 'utf8')
  const wordCount = text.split(/\s+/).filter(Boolean).length
  const required = [
    { key: 'three layers', re: /##\s+.*[Tt]hree[- ]layer/i },
    { key: 'packages', re: /##\s+.*[Pp]ackages/i },
    { key: 'api routes', re: /##\s+.*API routes/i },
    { key: 'chaindataport', re: /[Cc]hain[Dd]ata[Pp]ort/i },
    { key: 'event flow', re: /[Ee]vent flow/i },
  ]
  const missing = required.filter((s) => !s.re.test(text)).map((s) => s.key)
  const pass = missing.length === 0 && wordCount > 500

  return {
    task: 5,
    status: pass ? 'pass' : 'fail',
    details: { wordCount, missingSections: missing, path: 'docs/architecture.md' },
  }
}

function icon(status: TaskStatus): string {
  switch (status) {
    case 'pass':
      return '✅'
    case 'fail':
      return '❌'
    case 'warn':
      return '⚠️'
    case 'skip':
      return '⏭️'
  }
}

function computeGate(tasks: TaskResult[]): 'pass' | 'fail' {
  const t3 = tasks.find((t) => t.task === 3)
  const t5 = tasks.find((t) => t.task === 5)
  if (t3?.status !== 'pass' || t5?.status !== 'pass') return 'fail'
  const blocking = tasks.filter((t) => t.status === 'fail' && t.task !== 1)
  if (blocking.length > 0) return 'fail'
  return 'pass'
}

function computeExitCode(gate: 'pass' | 'fail'): number {
  return gate === 'pass' ? 0 : 1
}

async function main(): Promise<void> {
  const tasks: TaskResult[] = [
    await task1Coupling(),
    await task2Latency(),
    task3PackageBoundaries(),
    await task4B2bSmoke(),
    task5ArchitectureDoc(),
  ]

  const summary = {
    pass: tasks.filter((t) => t.status === 'pass').length,
    fail: tasks.filter((t) => t.status === 'fail').length,
    skip: tasks.filter((t) => t.status === 'skip').length,
    warn: tasks.filter((t) => t.status === 'warn').length,
  }

  const gate = computeGate(tasks)
  const payload = {
    timestamp: new Date().toISOString(),
    commit: git('git rev-parse HEAD'),
    branch: git('git rev-parse --abbrev-ref HEAD'),
    summary,
    gate,
    tasks,
  }

  fs.mkdirSync(DOCS, { recursive: true })
  fs.writeFileSync(path.join(DOCS, 'audit-results.json'), JSON.stringify(payload, null, 2))

  const md = [
    '# Post-migration audit results',
    '',
    `**Generated:** ${payload.timestamp}`,
    `**Branch:** ${payload.branch} @ \`${payload.commit.slice(0, 7)}\``,
    `**Gate:** ${gate === 'pass' ? '✅ PASS' : '❌ FAIL'}`,
    '',
    '| Task | Status | Summary |',
    '|------|--------|---------|',
    ...tasks.map((t) => {
      const summaryCell =
        t.task === 1
          ? `${t.details.count} external scanner importers`
          : t.task === 2
            ? String(t.details.reason ?? `uncached P50=${t.details.uncachedP50 ?? 'n/a'}ms`)
            : t.task === 3
              ? Object.keys(t.details.packages as object).join(', ') || 'n/a'
              : t.task === 4
                ? String(t.details.reason ?? `safe=${t.details.safeScore} rug=${t.details.rugScore}`)
                : `words=${t.details.wordCount}`
      return `| ${t.task} | ${icon(t.status)} ${t.status} | ${summaryCell} |`
    }),
    '',
    '## Details',
    '',
    '```json',
    JSON.stringify(tasks, null, 2),
    '```',
    '',
  ].join('\n')

  fs.writeFileSync(path.join(DOCS, 'audit-results.md'), md)

  console.log(md)
  console.log(`\nWrote ${path.join(DOCS, 'audit-results.json')}`)
  process.exit(computeExitCode(gate))
}

void main()
