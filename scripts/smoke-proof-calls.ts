/**
 * Smoke test for the Proof Engine surface.
 * Loads `.env.local` then `.env` (does not print secret values).
 *
 * Checks:
 *   1. Supabase tables `telegram_channels` + `signal_proof_calls` exist (migration state).
 *   2. GET /api/proof/calls returns a well-formed track record.
 *   3. GET /api/proof/calls/<unknown> responds 404 (not a crash).
 *
 * Usage:
 *   npm run test:proof-calls                       # tables + live prod endpoints
 *   PROOF_BASE_URL=http://localhost:3000 npm run test:proof-calls
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const BASE_URL = (process.env.PROOF_BASE_URL?.trim() || 'https://www.cryptocheckai.com').replace(/\/$/, '')

let failures = 0
function pass(msg: string): void {
  console.log(`  ✓ ${msg}`)
}
function fail(msg: string): void {
  failures += 1
  console.log(`  ✗ ${msg}`)
}

async function checkTable(url: string, key: string, table: string): Promise<void> {
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/${table}?select=*&limit=1`
  const res = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const text = await res.text()
  if (res.ok) {
    pass(`table "${table}" exists (HTTP ${res.status})`)
    return
  }
  let parsed: { code?: string; message?: string } | null = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = null
  }
  if (res.status === 404 || parsed?.code === 'PGRST205' || parsed?.code === '42P01') {
    fail(`table "${table}" MISSING — migration not applied yet`)
  } else {
    fail(`table "${table}" query failed HTTP ${res.status}: ${text.slice(0, 160)}`)
  }
}

async function checkTrackRecord(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/proof/calls`, { cache: 'no-store' } as RequestInit)
  if (!res.ok) {
    fail(`GET /api/proof/calls HTTP ${res.status}`)
    return
  }
  const body = (await res.json()) as Record<string, unknown>
  const requiredKeys = ['hitRate', 'callsThisMonth', 'pending', 'hits', 'misses', 'calls']
  const missing = requiredKeys.filter((k) => !(k in body))
  if (missing.length) {
    fail(`GET /api/proof/calls missing keys: ${missing.join(', ')}`)
    return
  }
  if (!Array.isArray(body.calls)) {
    fail('GET /api/proof/calls "calls" is not an array')
    return
  }
  pass(`GET /api/proof/calls OK (${(body.calls as unknown[]).length} calls, ${String(body.pending)} pending)`)
}

async function checkUnknownCall(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/proof/calls/00000000-0000-0000-0000-000000000000`, {
    cache: 'no-store',
  } as RequestInit)
  if (res.status === 404) {
    pass('GET /api/proof/calls/<unknown> → 404 as expected')
  } else {
    fail(`GET /api/proof/calls/<unknown> → HTTP ${res.status} (expected 404)`)
  }
}

async function main(): Promise<void> {
  console.log(`=== Proof Engine smoke (base: ${BASE_URL}) ===\n`)

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''

  console.log('Supabase migration state:')
  if (sbUrl && sbKey) {
    await checkTable(sbUrl, sbKey, 'telegram_channels')
    await checkTable(sbUrl, sbKey, 'signal_proof_calls')
  } else {
    console.log('  ⊘ skipped (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)')
  }

  console.log('\nProof API endpoints:')
  await checkTrackRecord()
  await checkUnknownCall()

  console.log(`\n=== ${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`} ===`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
