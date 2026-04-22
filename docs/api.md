# CryptoCheck API notes

## Institutional webhooks (Enterprise)

Enterprise workspaces can register HTTPS endpoints from the dashboard (**Webhooks**). Each row stores a signing secret; the server never echoes the full secret after creation.

### Headers

| Header | Value |
|--------|--------|
| `Content-Type` | `application/json` |
| `X-CryptoCheck-Event` | Event id (e.g. `scan.completed`, `risk.changed`) |
| `X-CryptoCheck-Timestamp` | Unix seconds (string) |
| `X-CryptoCheck-Signature` | `sha256=` + lowercase hex HMAC-SHA256 of the raw body using your webhook secret |

The JSON body is always:

```json
{
  "event": "scan.completed",
  "sent_at": "2026-04-22T12:00:00.000Z",
  "payload": { }
}
```

### Events

- **`scan.completed`** — emitted after a successful authenticated scan (not the public demo user).
- **`risk.changed`** — emitted when the daily watchlist cron detects a material score or verdict move for a saved mint.
- **`high_safety_token`** — optional legacy hook; still emitted when a scan is both very high score and `SAFE`.
- **`whale.moved`** — reserved for future portfolio / flow signals (no automated producer yet).

### Retries

The first delivery attempt runs immediately after the triggering scan or cron. Failures enqueue server-side retries with backoff gaps of approximately 30s, 2m, and 10m (four HTTP attempts total per trigger). After ten consecutive exhausted retry campaigns for an endpoint, the hook is automatically paused (`is_active = false`).

### Dashboard API

- `GET /api/dashboard/webhooks` — list hooks (no secrets).
- `POST /api/dashboard/webhooks` — body `{ "url": "https://…", "events": ["scan.completed"] }`; response includes `secret` once.
- `PATCH /api/dashboard/webhooks/:id` — `{ "url"?, "events"?, "is_active"? }`.
- `DELETE /api/dashboard/webhooks/:id`.
- `POST /api/dashboard/webhooks/test` — body `{ "webhookId": "uuid" }`; sends a `scan.completed` test payload.

All of the above require a signed-in **Enterprise** user.

## Batch scan (`POST /api/v1/scan/batch`)

Bulk platform scans: `items` array of `{ "tokenAddress", "chain" }` (or legacy `tokenAddresses`). Caps: Free **5**, Pro **20**, Institutional **100** per request; daily quota decreases by the number of items.

Optional **`clientRef`** (string, max 80 characters) in the JSON body, or HTTP header **`X-CryptoCheck-Client-Ref`**, is echoed as **`client_ref`** in the JSON response and recorded on the batch `api_usage` audit event for desk / org traceability.

Dashboard: authenticated Pro or Institutional users can run batches from **`/dashboard/batch`** (session cookie). Free-tier batch access uses an **API key** from the same endpoint.

## Public status

- **`GET /status`** — Human-readable status page (SLA summary, component checks, optional rolling uptime when Redis + cron probes are enabled).
- **`GET /api/status/public`** — JSON for the same payload (no auth). Intended for vanity hosts (e.g. `status.example.com` → `/status`) and external monitors.

Synthetic uptime samples are appended when **`/api/cron/uptime-check`** succeeds (Vercel cron, `CRON_SECRET`). Rolling **30-day** percentage is derived from the probe list in **Upstash Redis** when configured.

Optional env **`STATUS_ACTIVE_INCIDENTS_JSON`**: JSON array of `{ "title", "description?", "severity": "minor"|"major"|"maintenance", "since?" }` for on-page incident banners.

## Upgrade summary

See **`docs/DASHBOARDS_UPGRADE_SUMMARY.md`** for the full dashboards / APIs / migrations / cron checklist (Phases 1–7).
