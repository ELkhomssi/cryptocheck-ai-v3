/**
 * Manual verify helpers for page_views (run after applying the SQL migration).
 *
 *   npx tsx scripts/verify-page-views.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IP_HASH_SALT in .env.local
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { hashIp, insertPageView, isBot } from '../lib/page-views/capture'

function loadEnv() {
  const raw = readFileSync('.env.local', 'utf8')
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    const k = line.slice(0, i).trim()
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!(k in process.env)) process.env[k] = v
  }
}

async function countRows(): Promise<number> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('missing supabase env')
  const res = await fetch(`${url}/rest/v1/page_views?select=id`, {
    method: 'HEAD',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  })
  if (res.status === 404) throw new Error('page_views table missing — apply supabase/migrations/20260719_page_views.sql')
  const cr = res.headers.get('content-range') || ''
  return Number(cr.split('/')[1] || '0')
}

async function main() {
  loadEnv()
  const before = await countRows()
  console.log('before_count', before)

  const sid = randomUUID()
  const humanUa =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  assertBotSkipped()

  const hashed = await hashIp('198.51.100.9')
  if (!hashed || hashed === '198.51.100.9' || !/^[a-f0-9]{64}$/.test(hashed)) {
    throw new Error('ip hash invalid')
  }

  const r1 = await insertPageView({
    session_id: sid,
    ip_address: hashed,
    user_agent: humanUa,
    referrer: 'https://t.co/test',
    path: '/dashboard',
  })
  const r2 = await insertPageView({
    session_id: sid,
    ip_address: hashed,
    user_agent: humanUa,
    referrer: 'https://t.co/test',
    path: '/dashboard',
  })
  if (!r1.ok || !r2.ok) throw new Error(`insert failed ${r1.status} ${r2.status}`)

  const after = await countRows()
  console.log('after_count', after)
  console.log('delta', after - before)
  console.log('session_id_reused', sid)
  console.log('ip_address_sample', hashed.slice(0, 16) + '…')
  console.log('ok', after === before + 2)
}

function assertBotSkipped() {
  if (!isBot('curl/8.0')) throw new Error('curl should be bot')
  if (!isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')) throw new Error('googlebot should be bot')
  console.log('bot_ua_skipped_by_isBot', true)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
