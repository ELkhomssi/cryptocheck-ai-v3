'use client'

import { useState } from 'react'
import { GlassCard } from '@/components/Dashboard/GlassCard'

const TABS = [
  { id: 'ts', label: 'TypeScript' },
  { id: 'py', label: 'Python' },
  { id: 'curl', label: 'cURL' },
] as const

const TS_SAMPLE = `import { CryptoCheckClient } from '@/lib/sdk/cryptocheck-sdk'

const client = new CryptoCheckClient({
  apiKey: process.env.CRYPTOCHECK_API_KEY!,
  // baseUrl optional — defaults to https://www.cryptocheckai.com
  // signingSalt optional — uses CRYPTOCHECK_SIGNING_SALT → API_SIGNING_SALT → dev fallback
})

const result = await client.scanToken('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', {
  chain: 'solana',
  responseMode: 'platform',
})

console.log(result)`

const PY_SAMPLE = `import os, json, time, hashlib, hmac, urllib.request

API_KEY = os.environ["CRYPTOCHECK_API_KEY"]
BASE = os.environ.get("CRYPTOCHECK_BASE_URL", "https://www.cryptocheckai.com").rstrip("/")
# Same salt string as server API_SIGNING_SALT (dev fallback matches docs)
SALT = os.environ.get("CRYPTOCHECK_SIGNING_SALT") or os.environ.get("API_SIGNING_SALT") or "cryptocheck_dev_api_signing_salt_v1"

def derived_key(api_key: str) -> bytes:
    return hashlib.sha256((api_key + SALT).encode("utf-8")).digest()

def sign(ts: str, raw_body: str, api_key: str) -> str:
    msg = f"{ts}\n{raw_body}".encode("utf-8")
    return hmac.new(derived_key(api_key), msg, hashlib.sha256).hexdigest()

body = {"tokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "chain": "solana", "responseMode": "platform"}
raw = json.dumps(body, separators=(",", ":"))
ts = str(int(time.time()))
req = urllib.request.Request(
    f"{BASE}/api/v1/scan",
    data=raw.encode("utf-8"),
    method="POST",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/vnd.cryptocheck.platform+json",
        "X-CryptoCheck-Timestamp": ts,
        "X-CryptoCheck-Signature": sign(ts, raw, API_KEY),
    },
)
with urllib.request.urlopen(req) as resp:
    print(resp.read().decode())`

const CURL_SAMPLE = `export CRYPTOCHECK_API_KEY="cc_live_..."
export TS=$(date +%s)
export BODY='{"tokenAddress":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","chain":"solana","responseMode":"platform"}'
# Signature: HMAC-SHA256( SHA256(api_key + SALT), "$TS\\n$BODY" ) as hex — use SDK or script for production.

curl -sS "https://www.cryptocheckai.com/api/v1/scan" \\
  -H "Authorization: Bearer $CRYPTOCHECK_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/vnd.cryptocheck.platform+json" \\
  -H "X-CryptoCheck-Timestamp: $TS" \\
  -d "$BODY"`

export function DocsQuickStart() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('ts')
  const code = tab === 'ts' ? TS_SAMPLE : tab === 'py' ? PY_SAMPLE : CURL_SAMPLE

  return (
    <GlassCard accent="sentinel" className="overflow-hidden">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Quick start</p>
        <p className="mt-1 text-sm font-medium text-slate-400">
          One integration path — TypeScript SDK (recommended), or raw HTTP in Python / cURL.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] transition-all duration-150 ease-out ${
                tab === t.id
                  ? 'bg-white/[0.1] text-slate-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                  : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <pre className="max-h-[min(480px,55vh)] overflow-auto p-5 text-[0.72rem] leading-relaxed text-slate-300">
        <code>{code}</code>
      </pre>
    </GlassCard>
  )
}
