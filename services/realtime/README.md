# Signal Realtime Gateway (Prompt 4)

WebSocket server + history REST API. Consumes `ccai:sig:stream:feed`.

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `WS /` | Filtered push feed |
| `GET /v1/history` | Initial load (Postgres via Supabase) |
| `GET /health` | Liveness |

Same-origin UI proxy: `GET /api/signals/history` (Next.js → this service).

## WebSocket protocol

1. Server sends `{ type: 'hello', tier, compliance, delayMs }`
2. Client sends `{ type: 'subscribe', filter: { chain?, minVerdict?, minSourceCount?, search? }, userId? }`
3. Server pushes `SignalFeedEvent` or coalesced `{ type: 'batch', events, coalescedAt }`

## Freemium (server-enforced)

| Tier | Behavior |
|------|----------|
| **free** | 90s delay, SAFE-only, `sourceCount >= 2`, max 25 history rows |
| **premium** | Real-time, full filters, max 200 history rows |

Premium auth: `Authorization: Bearer $SIGNAL_PREMIUM_TOKEN` or `signal_subscription.tier = premium` in Supabase.

## Run

```bash
cd services/realtime
cp .env.example .env
npm install
npm run dev
curl http://localhost:4102/health
curl 'http://localhost:4102/v1/history?limit=10'
```

## Env

- `SIGNAL_REALTIME_PORT` (default 4102)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `SIGNAL_PREMIUM_TOKEN` — bearer for premium tier
- `SIGNAL_FREE_DELAY_MS` (default 90000)
- `SIGNAL_WS_COALESCE_MS` (default 250)
