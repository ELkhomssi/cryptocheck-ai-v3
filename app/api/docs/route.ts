import { NextResponse } from 'next/server'
import { SCAN_API_DOCS_DEV_SIGNING_SALT } from '@/lib/security/signing'

export const dynamic = 'force-dynamic'

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CryptoCheck Security Intelligence API</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0a0a0f; color: #e8e8ef; margin: 0; padding: 32px 24px 64px; line-height: 1.55; }
    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    h2 { font-size: 1.1rem; margin-top: 28px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; }
    code, pre { font-family: ui-monospace, monospace; font-size: 12px; }
    pre { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px; overflow-x: auto; }
    .muted { color: #94a3b8; font-size: 14px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 12px; }
    th, td { border: 1px solid rgba(255,255,255,0.08); padding: 8px 10px; text-align: left; }
    th { background: rgba(16,185,129,0.08); color: #6ee7b7; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(16,185,129,0.15); color: #6ee7b7; font-size: 11px; }
  </style>
</head>
<body>
  <p class="pill">v1</p>
  <h1>CryptoCheck Security Intelligence API</h1>
  <p class="muted">Developer-first on-chain risk analysis. Authenticate with <code>Authorization: Bearer &lt;api_key&gt;</code> or a Pro/Institutional browser session (dashboard).</p>

  <h2>Authentication</h2>
  <pre>Authorization: Bearer cc_live_…
X-API-Key: cc_live_…</pre>
  <p class="muted">API keys are created via the developer console / keys endpoint. Free tier keys are limited to 10 requests/day; Pro 1,000/day; Enterprise high cap.</p>

  <h2 id="security">Request signing (optional)</h2>
  <p>For <code>X-CryptoCheck-Signature</code>, your API key is the <strong>root credential</strong>, but the server never uses the raw key string as the HMAC key. Both sides derive the same signing key and then compute the request MAC.</p>
  <ol style="margin-top:12px;padding-left:20px;">
    <li><strong>Signing salt</strong> — same UTF-8 string as the server env <code>API_SIGNING_SALT</code> (required in production).</li>
    <li><strong>Derived key</strong> — <code>SHA256( api_key + signing_salt )</code> (string concatenation, UTF-8 in / SHA-256 out → 32-byte key). The raw API key is not passed to HMAC directly.</li>
    <li><strong>Message</strong> — <code>timestamp + "\\n" + raw_request_body</code> (exact bytes you send; use the same timestamp as <code>X-CryptoCheck-Timestamp</code>).</li>
    <li><strong>Signature</strong> — <code>HMAC-SHA256( derived_key, message_utf8 )</code>; send hex or base64 in <code>X-CryptoCheck-Signature</code>.</li>
  </ol>
  <p class="muted">Development only: if <code>API_SIGNING_SALT</code> is not set, the server uses fallback <code>${SCAN_API_DOCS_DEV_SIGNING_SALT}</code> — use that salt when signing against a local dev server.</p>

  <h2>POST /api/v1/scan</h2>
  <p>Full institutional payload (default) or compact <strong>platform</strong> JSON for integrations.</p>
  <p><strong>Platform mode:</strong> set <code>"responseMode": "platform"</code> or header <code>Accept: application/vnd.cryptocheck.platform+json</code>.</p>
  <pre>{
  "tokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "chain": "solana",
  "liquidityUsd": 8500000,
  "topHolderPct": 12,
  "responseMode": "platform"
}</pre>
  <p class="muted">Legacy field <code>mint</code> is still supported. Same response shape as before when <code>responseMode</code> is omitted (UI-compatible).</p>

  <h2>POST /api/v1/scan/sandbox</h2>
  <p>Deterministic sandbox analysis — same engine path without serialized on-chain swap simulation. Optional body <code>{ "tokenAddress": "…" }</code> to override mint.</p>

  <h2>POST /api/v1/scan/batch</h2>
  <p>Bulk platform scans. Max batch: Free 5, Pro 20, Enterprise 100. Consumes daily quota equal to item count. Optional <code>clientRef</code> (≤80 chars) or header <code>X-CryptoCheck-Client-Ref</code> is echoed as <code>client_ref</code> and logged for org/desk traceability. Console UI: <code>/dashboard/batch</code> (Pro+ session).</p>
  <pre>{
  "chain": "solana",
  "clientRef": "desk-nyc-42",
  "items": [
    { "tokenAddress": "EPjF…", "chain": "solana" }
  ]
}</pre>

  <h2>Priority (Enterprise)</h2>
  <p>Send <code>X-CryptoCheck-Priority: high</code> — logged for future priority queues.</p>

  <h2 id="status">Public status &amp; SLA</h2>
  <p>Human page <code>/status</code> and JSON <code>GET /api/status/public</code> (no auth). Shows dependency health, SLA target copy, and optional 30-day rolling probe availability when Upstash Redis is configured and the uptime cron runs.</p>

  <h2 id="webhooks">Webhooks (Enterprise)</h2>
  <p>Register HTTPS targets from the authenticated dashboard (<code>/dashboard/webhooks</code>). The server POSTs JSON with <code>X-CryptoCheck-Event</code>, <code>X-CryptoCheck-Timestamp</code>, and <code>X-CryptoCheck-Signature: sha256=&lt;hex&gt;</code> (HMAC-SHA256 of the raw body). Events include <code>scan.completed</code>, <code>risk.changed</code> (watchlist cron), optional legacy <code>high_safety_token</code>, and reserved <code>whale.moved</code>.</p>
  <p class="muted">See <code>docs/api.md</code> for retry behaviour, dashboard CRUD routes under <code>/api/dashboard/webhooks</code>, and the test endpoint.</p>

  <h2>Error format</h2>
  <pre>{ "error": "string", "code": 400, "reason": "INVALID_INPUT" }</pre>

  <h2>HTTP status codes</h2>
  <table>
    <tr><th>Code</th><th>Meaning</th></tr>
    <tr><td>200</td><td>Success</td></tr>
    <tr><td>400</td><td>Invalid input (mint, chain, batch size)</td></tr>
    <tr><td>401</td><td>Missing or invalid API key / session</td></tr>
    <tr><td>403</td><td>Insufficient subscription (session-only routes)</td></tr>
    <tr><td>429</td><td>Rate limit or daily quota exceeded</td></tr>
    <tr><td>500</td><td>Internal error</td></tr>
    <tr><td>501</td><td>Not implemented (webhooks registration)</td></tr>
  </table>
</body>
</html>`

export async function GET() {
  return new NextResponse(HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
