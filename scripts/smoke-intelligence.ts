/**
 * Intelligence API smoke tests (local or staging).
 *
 * Prerequisites:
 *   - `npm run dev` on TEST_BASE_URL (default http://localhost:3000)
 *   - INTELLIGENCE_API_KEY or TEST_API_KEY = cc_live_* or cc_sentinel_*
 *
 * Usage:
 *   INTELLIGENCE_API_KEY=cc_live_... npm run test:intelligence
 *
 * Resolves canonical WIF mint via DexScreener search (dogwifhat) at runtime;
 * see `WIF_RESOLUTION_NOTE` in stdout.
 */

import 'dotenv/config'
import { Keypair } from '@solana/web3.js'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const API_KEY = process.env.INTELLIGENCE_API_KEY || process.env.TEST_API_KEY || ''

const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'

/** Invalid / edge-case inputs */
const INVALID_MINT = 'not-a-mint'
/** Valid base58 mint with no meaningful pair (random keypair each run). */
function randomValidMint(): string {
  return Keypair.generate().publicKey.toBase58()
}

let WIF_RESOLUTION_NOTE = ''

async function resolveWifMintFromDex(): Promise<string> {
  try {
    const r = await fetch('https://api.dexscreener.com/latest/dex/search?q=dogwifhat')
    const j = (await r.json()) as {
      pairs?: Array<{ baseToken?: { address?: string } }>
    }
    const addr = j.pairs?.[0]?.baseToken?.address
    if (typeof addr === 'string' && addr.length >= 32) {
      WIF_RESOLUTION_NOTE = `DexScreener search "dogwifhat" top pair baseToken.address → ${addr}`
      return addr
    }
  } catch (e) {
    console.warn('[smoke-intelligence] DexScreener WIF resolve failed:', e)
  }
  const fallback = 'EKpQGSml4jJeE3yJGk2bCRfFsGPNJMhTqHMLHJNK4p'
  WIF_RESOLUTION_NOTE = `Fallback (DexScreener search returned no baseToken): ${fallback}`
  return fallback
}

async function postJson(path: string, body: unknown, headers?: Record<string, string>) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  return { res, json }
}

async function main() {
  console.log('Intelligence API smoke —', BASE_URL)
  console.log('')

  const wifMint = await resolveWifMintFromDex()
  console.log('WIF mint for tests:', wifMint)
  console.log(WIF_RESOLUTION_NOTE)
  console.log('')

  // --- verify: invalid key (expect 401) ---
  const badVerify = await postJson('/api/v1/keys/verify', { key: 'cc_live_invalid_test_key_xxxxxxxxxxxx' })
  console.log(
    'POST /api/v1/keys/verify (bad key) →',
    badVerify.res.status,
    (badVerify.json as { error?: string })?.error ?? ''
  )

  if (!API_KEY) {
    console.log('')
    console.log('Skip authenticated tests: set INTELLIGENCE_API_KEY or TEST_API_KEY')
    process.exit(0)
  }

  // --- verify: success ---
  const okVerify = await postJson('/api/v1/keys/verify', { key: API_KEY })
  console.log(
    'POST /api/v1/keys/verify (good key) →',
    okVerify.res.status,
    JSON.stringify(okVerify.json, null, 2)
  )

  const auth = { Authorization: `Bearer ${API_KEY}` }

  // --- scan: invalid mint ---
  const badMint = await postJson(
    '/api/v1/intelligence/scan',
    { mintAddress: INVALID_MINT },
    auth
  )
  console.log('POST /intelligence/scan invalid mint →', badMint.res.status)

  // --- scan: valid-format mint (random; expect 404 when Dex + Helius have no data) ---
  const ghostMint = randomValidMint()
  const weird = await postJson('/api/v1/intelligence/scan', { mintAddress: ghostMint }, auth)
  console.log('POST /intelligence/scan random valid mint →', weird.res.status)

  // --- scan: BONK full ---
  const bonk = await postJson('/api/v1/intelligence/scan', { mintAddress: BONK }, auth)
  console.log('POST /intelligence/scan BONK →', bonk.res.status, 'scanId:', (bonk.json as { meta?: { scanId?: string } })?.meta?.scanId)

  // --- scan: WIF full ---
  const wif = await postJson('/api/v1/intelligence/scan', { mintAddress: wifMint }, auth)
  console.log('POST /intelligence/scan WIF →', wif.res.status, 'scanId:', (wif.json as { meta?: { scanId?: string } })?.meta?.scanId)

  // --- scan: ticker only ---
  const tick = await postJson(
    '/api/v1/intelligence/scan',
    { mintAddress: BONK, only: 'ticker' },
    auth
  )
  console.log('POST /intelligence/scan ticker BONK →', tick.res.status)

  console.log('')
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
