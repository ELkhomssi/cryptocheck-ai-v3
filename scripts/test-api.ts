/**
 * One-off dependency probe: Helius RPC, OpenAI REST, Supabase REST.
 * Loads `.env.local` then `.env` (does not print secret values).
 *
 * Usage: `npm run test:api-probe`
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

function envLine(name: string): string {
  const v = process.env[name]
  if (!v?.trim()) return `${name}: NOT SET`
  const t = v.trim()
  return `${name}: SET (length ${t.length}, first/last char code ${t.charCodeAt(0)}/${t.charCodeAt(t.length - 1)})`
}

async function probeHelius(key: string): Promise<void> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
  })
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = null
  }
  const p = parsed as { error?: { code?: number; message?: string }; result?: string } | null
  console.log(`\n--- Helius JSON-RPC (getHealth) HTTP ${res.status} ---`)
  if (!res.ok) {
    console.log('Body (truncated):', text.slice(0, 400))
    return
  }
  if (p?.error) {
    console.log('JSON-RPC error:', JSON.stringify(p.error))
  } else {
    console.log('OK result:', p?.result ?? text.slice(0, 200))
  }
}

async function probeOpenAI(key: string): Promise<void> {
  const res = await fetch('https://api.openai.com/v1/models?limit=1', {
    headers: { Authorization: `Bearer ${key}` },
  })
  const text = await res.text()
  console.log(`\n--- OpenAI GET /v1/models HTTP ${res.status} ---`)
  if (!res.ok) {
    console.log('Body (truncated):', text.slice(0, 400))
    return
  }
  console.log('OK (first 120 chars):', text.slice(0, 120))
}

async function probeSupabase(url: string, serviceKey: string): Promise<void> {
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/profiles?select=id&limit=1`
  const res = await fetch(endpoint, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  })
  const text = await res.text()
  console.log(`\n--- Supabase REST profiles probe HTTP ${res.status} ---`)
  if (!res.ok) {
    console.log('Body (truncated):', text.slice(0, 400))
    return
  }
  console.log('OK (truncated):', text.slice(0, 200))
}

async function main(): Promise<void> {
  console.log('=== Environment (masked) ===')
  console.log(envLine('HELIUS_API_KEY'))
  console.log(envLine('HELIUS_KEY'))
  console.log(envLine('OPENAI_API_KEY'))
  console.log(envLine('OPENAI_KEY'))
  console.log(envLine('NEXT_PUBLIC_SUPABASE_URL'))
  console.log(envLine('SUPABASE_SERVICE_ROLE_KEY'))

  const helius =
    process.env.HELIUS_API_KEY?.trim() || process.env.HELIUS_KEY?.trim() || ''
  const openai = process.env.OPENAI_API_KEY?.trim() || process.env.OPENAI_KEY?.trim() || ''
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''

  if (helius) await probeHelius(helius)
  else console.log('\n--- Helius: skipped (no HELIUS_API_KEY / HELIUS_KEY) ---')

  if (openai) await probeOpenAI(openai)
  else console.log('\n--- OpenAI: skipped (no OPENAI_API_KEY / OPENAI_KEY) ---')

  if (sbUrl && sbKey) await probeSupabase(sbUrl, sbKey)
  else console.log('\n--- Supabase: skipped (missing URL or SUPABASE_SERVICE_ROLE_KEY) ---')

  console.log('\n=== Done ===')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
