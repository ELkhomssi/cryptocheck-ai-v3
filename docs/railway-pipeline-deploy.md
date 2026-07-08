# Railway pipeline deploy

Long-running signal workers run on **Railway**; Vercel hosts the Next.js UI only.

## Topology

```
Railway: cryptocheck-pipeline
├── telegram-monitor   → services/ingestion   (GramJS → Redis unified stream)
├── gate-worker        → services/pipeline    (npm run start:gate)
├── realtime-gateway   → services/realtime    (public domain + WSS)
├── scanner            → services/scanner     (deep audit + kill-switch, /scan)
└── sniper             → services/sniper      (detect → scan → emit candidate)

Shared: Upstash Redis · Supabase Postgres
Vercel: NEXT_PUBLIC_SIGNAL_WS_URL → realtime-gateway public URL
Non-custodial: sniper emits candidates only; the browser signs swaps via Phantom.
```

## 1. Create Railway project

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo `connect-mobile`.
2. Add **three services** from the same repo (monorepo):

| Service name       | Root directory        | Start command              | Health check |
|--------------------|-----------------------|----------------------------|--------------|
| `telegram-monitor` | `services/ingestion`  | `npm run start`            | `/healthz`   |
| `gate-worker`      | `services/pipeline`   | `npm run start:gate`       | `/healthz`   |
| `realtime-gateway` | `services/realtime`   | `npm run start`            | `/healthz`   |
| `scanner`          | `services/scanner`    | `npm run start`            | `/healthz`   |
| `sniper`           | `services/sniper`     | `npm run start`            | `/healthz`   |

**Build command (all):**
```bash
npm run build --prefix ../../packages/signal-contracts && npm install && npm run build
```

Or use `services/Dockerfile.signal-worker` with `SIGNAL_SERVICE=ingestion|gate|realtime|scanner|sniper`.

## 2. Environment variables (shared)

Set on **all three** Railway services:

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SUPABASE_URL=              # same as NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=
SIGNAL_WORKER_SECRET=        # match Vercel
```

### telegram-monitor only

```
SIGNAL_SOURCES=telegram
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_SESSION_STRING=     # or TELEGRAM_SESSION — from local `npm run auth`
```

**Telegram session:** run locally once:
```bash
cd services/ingestion && npm run auth
```
Copy the printed `StringSession` into Railway — no interactive login on Railway.

### gate-worker only

```
SIGNAL_ASSESS_URL=https://www.cryptocheckai.com/api/internal/signals/assess
SIGNAL_AGENT_SIGNING_KEY=
SIGNAL_AGENT_ENABLED=true
```

### realtime-gateway only

```
SIGNAL_REALTIME_PORT=$PORT    # Railway injects PORT
```

Generate a **public domain** on `realtime-gateway` (e.g. `cryptocheck-realtime.up.railway.app`).

### scanner only

```
SIGNAL_ASSESS_URL=https://www.cryptocheckai.com/api/internal/signals/assess
HELIUS_API_KEY=              # direct Helius RPC for mint/freeze kill-switch
```

Keep `scanner` **private** (internal networking only) — it is called by `sniper` and
by `/api/internal/*`, never directly by the browser.

### sniper only

```
SCANNER_URL=http://scanner.railway.internal:4103   # private URL of the scanner service
SNIPER_MIN_SCORE=70
SNIPER_TRIGGER_TYPES=buy
# SNIPER_LOG_ALL_SCANS=false   # candidate + blocked are always logged
```

The sniper is a **market-wide detector** — it never holds keys or signs. It writes
`signal_snipe_actions` (scan/candidate/blocked audit) and emits candidates to
`ccai:sig:snipe:candidates`; the execution layer arms per-user + signs via Phantom.

## 3. Supabase: channel allowlist

Apply migration `supabase/migrations/20260706_telegram_channels.sql`, then insert channels:

```sql
INSERT INTO telegram_channels (username, enabled, label) VALUES
  ('@your_public_channel', true, 'Alpha calls');
```

`telegram-monitor` reads enabled rows on boot and every 5 minutes.

Also apply `supabase/migrations/20260709_signal_snipe_actions.sql` (AI Sniper audit trail).

## 4. Point Vercel at Railway

In Vercel → Environment Variables (Production):

```
SIGNAL_REALTIME_URL=https://<realtime-gateway>.up.railway.app
NEXT_PUBLIC_SIGNAL_WS_URL=wss://<realtime-gateway>.up.railway.app
```

Redeploy Vercel after setting these.

## 5. Heartbeats & dashboard

Each worker writes `ccai:sig:heartbeat:<service>` to Redis every 15s.

The dashboard **Data Sources** chip reads the `telegram-monitor` heartbeat — shows real joined channel count when the worker is alive.

## 6. Definition of done

- [ ] Railway logs: `Connected to Telegram` / `Monitoring N channels`
- [ ] Dashboard chip: `Telegram · N Channels` (same N)
- [ ] Post in a monitored channel → Master Feed row within ~2s
- [ ] WS hello includes `serverTime` + `monitoredChannels`
- [ ] UI: `Connecting…` → `Live · listening…` → `Live` (no false "Reconnecting" on first load)

## Next phases

- **Proof Engine** — set `PROOF_ENGINE_ENABLED=true` on gate-worker (start with `PROOF_ENGINE_DRY_RUN=true`)
- **Subscription gate** — `SIGNAL_FREE_DELAY_MS=90000` on realtime-gateway; free tier sees `delayedBy` upsell on `/dashboard/signals`
- **AI Sniper execution layer** (next) — client consumes `ccai:sig:snipe:candidates`; Pro ($10/mo) users get Full Auto (build tx → Phantom signs); confirmed swaps logged to `signal_snipe_actions` + `signal_proof_calls`
