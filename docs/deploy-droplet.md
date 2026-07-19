# Deploy Signal Publishers to a Shared DigitalOcean Droplet

Smart Alpha Feed **read path** runs on Vercel (`/api/signals/history` polls Supabase).  
**Write path** requires two long-running workers:

| Container | `SIGNAL_SERVICE` | Role |
|-----------|------------------|------|
| `ingestion` | `ingestion` | Telegram GramJS listener → Redis `ccai:sig:stream:unified` |
| `gate` | `gate` | Consume unified stream → scan → `signal_normalized` |

**Not deployed:** `services/realtime` — dashboard uses **poll mode** (~20s).

---

## Prerequisites

- Ubuntu droplet with Docker (may already host another project)
- ≥ **700 MB free RAM** and disk headroom for two 512 MB-capped containers
- Supabase migrations applied (see [Migrations](#supabase-migrations))
- Telegram session generated **locally** (never interactively on the server)
- Same Upstash Redis + Supabase project as Vercel Production

---

## 1. Preflight (shared server safety)

SSH into the droplet and record the **other project's** containers before touching anything:

```bash
free -h
df -h
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
```

Confirm:

- `free` shows ≥ 700 MB available (two workers × 512 MB cap + OS buffer)
- `df` has several GB free (images + logs)
- You know which container names belong to the **other** project — never run `docker compose down` without `-p cryptocheck-signal`

---

## 2. Install Docker (if missing)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
newgrp docker   # or re-login
docker compose version
```

---

## 3. Clone repo

```bash
sudo mkdir -p /opt/cryptocheck
sudo chown "$USER:$USER" /opt/cryptocheck
git clone git@github.com:<org>/crypto.git /opt/cryptocheck
cd /opt/cryptocheck
```

Use a read-only deploy key. Updates: `git -C /opt/cryptocheck pull`.

---

## 4. Configure worker env

```bash
cd /opt/cryptocheck
cp deploy/.env.signal.example deploy/.env.signal
chmod 600 deploy/.env.signal
nano deploy/.env.signal   # fill all required values
```

### Required values

| Variable | Notes |
|----------|-------|
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | Same as Vercel Production |
| `SUPABASE_URL` | Worker name — **not** `NEXT_PUBLIC_*`. Same host as `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as Vercel |
| `SIGNAL_WORKER_SECRET` | **Identical** to Vercel Production |
| `SIGNAL_ASSESS_URL` | `https://www.cryptocheckai.com` |
| `TELEGRAM_API_ID` / `HASH` / `SESSION_STRING` | From https://my.telegram.org/apps |
| `SIGNAL_SOURCES` | `telegram` (add `,txodds` only when `TXLINE_API_TOKEN` is set) |

### Generate Telegram session (local machine)

```bash
cd services/ingestion
cp .env.example .env.local   # add API_ID, API_HASH
npm run auth
# Copy printed TELEGRAM_SESSION_STRING into deploy/.env.signal on the droplet
```

Interactive login **cannot** run on the server.

### Enable TxODDS (same `ingestion` container — no new compose service)

TxODDS uses **TxLINE** credentials. The env name is `TXLINE_API_TOKEN` (not `TXODDS_API_KEY`).

1. Activate authorized access: https://txline.txodds.com/documentation/worldcup  
2. Edit `deploy/.env.signal` on the droplet (`chmod 600` — never commit):

```bash
SIGNAL_SOURCES=telegram,txodds
TXLINE_API_ORIGIN=https://txline.txodds.com
TXLINE_API_TOKEN=<your_token>
# TXLINE_JWT=          # optional; omit to fetch guest JWT
TXLINE_STREAM_MODE=both
# TXLINE_FIXTURE_IDS=  # optional comma-separated fixture IDs
```

3. Restart ingestion only:

```bash
cd /opt/cryptocheck
./deploy/enable-txodds.sh
# paste TXLINE_API_TOKEN when prompted

# or non-interactive:
# TXLINE_API_TOKEN='...' ./deploy/enable-txodds.sh
```

Manual equivalent:

```bash
cd /opt/cryptocheck
docker compose -p cryptocheck-signal -f deploy/docker-compose.signal.yml up -d ingestion
docker exec cryptocheck-signal-ingestion-1 wget -qO- http://127.0.0.1:4101/health | python3 -m json.tool
```

Expect `"sources"` to include `"txodds"` and `txodds.streams` connected.

4. Verify rows in Supabase (`match_event`, never swap path):

```bash
cd /opt/cryptocheck && set -a && source deploy/.env.signal && set +a

curl -sI "${SUPABASE_URL%/}/rest/v1/signal_normalized?select=id&source_tag=eq.txodds" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Prefer: count=exact" | grep -i content-range

curl -s "${SUPABASE_URL%/}/rest/v1/signal_normalized?source_tag=eq.txodds&select=id,label,event_type,sentinel_verdict,msg_timestamp,dropped&order=msg_timestamp.desc&limit=5" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | python3 -m json.tool
```

### Telegram channel allowlist (SOLTRENDING)

If `column "platform" does not exist`, add it first, then enroll.

```sql
-- 1) platform column (from 20260708_source_platform.sql)
ALTER TABLE telegram_channels
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'telegram';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_channels_platform_check'
  ) THEN
    ALTER TABLE telegram_channels
      ADD CONSTRAINT telegram_channels_platform_check
      CHECK (platform IN ('telegram', 'twitter'));
  END IF;
END $$;

ALTER TABLE telegram_channels DROP CONSTRAINT IF EXISTS telegram_channels_username_unique;
CREATE UNIQUE INDEX IF NOT EXISTS telegram_channels_platform_username_key
  ON telegram_channels (platform, username);

-- 2) Enroll SOLTRENDING
INSERT INTO telegram_channels (username, platform, enabled, label)
VALUES ('SOLTRENDING', 'telegram', true, 'SOLTRENDING')
ON CONFLICT (platform, username) DO UPDATE
  SET enabled = true, updated_at = now();
```

**Legacy fallback** (only if you cannot add `platform` yet):

```sql
INSERT INTO telegram_channels (username, enabled, label)
VALUES ('SOLTRENDING', true, 'SOLTRENDING')
ON CONFLICT (username) DO UPDATE
  SET enabled = true, updated_at = now();
```

DexT / Screener textUrl links in channel posts are parsed for Solana CAs → `telegram:ca-hit` → gate scan.

### TxODDS / TxLINE (sports — not tokens)

`SIGNAL_SOURCES=telegram,txodds` + `TXLINE_API_TOKEN`. Emits `match_event` rows only — **never** enters the Jupiter swap / Early Gem token path. Token Alpha Feed is Telegram CAs only.

---

## 5. Channel allowlist (Supabase)

Workers read `telegram_channels` on boot and **re-fetch every 5 minutes** (`channel-registry.ts`).  
New rows are picked up on the next refresh; **joining new channels requires an ingestion restart** (logged as `channel list changed — restart service to re-join`).

Run in **Supabase SQL Editor** (replace usernames with real public channels you monitor):

```sql
-- Requires 20260706_telegram_channels.sql (+ 20260708_source_platform.sql for platform column)
INSERT INTO telegram_channels (username, platform, enabled, label)
VALUES
  ('watcherguru', 'telegram', true, 'Watcher Guru'),
  ('solana',      'telegram', true, 'Solana Official'),
  ('cobie',       'telegram', true, 'Cobie')
ON CONFLICT (platform, username) DO UPDATE
  SET enabled = true, updated_at = now();

SELECT username, enabled FROM telegram_channels WHERE platform = 'telegram' AND enabled = true;
```

If the table is empty and Supabase is unreachable, ingestion falls back to `services/ingestion/config/channels.json` (empty in repo).

---

## 6. Start workers

Always use the **isolated compose project name** so the other project's containers are never affected:

```bash
cd /opt/cryptocheck
docker compose -p cryptocheck-signal -f deploy/docker-compose.signal.yml up -d --build
```

No ports are published — workers only dial **out** to Telegram, Upstash, Supabase, and Vercel.

### Boot logs to expect

```bash
docker compose -p cryptocheck-signal -f deploy/docker-compose.signal.yml logs -f
```

| Service | Success lines |
|---------|---------------|
| **ingestion** | `[channel-registry] loaded channels from Supabase { count: N }` (N > 0) |
| **ingestion** | `[signal-ingestion] Connected to Telegram` |
| **ingestion** | `[signal-ingestion] Monitoring N channels` (N > 0) |
| **gate** | `[signal-pipeline:gate] Gate consumer started` |

### Heartbeats (Upstash)

Workers write Redis keys every ~15s (45s TTL):

- `ccai:sig:heartbeat:telegram-monitor` — `channels` field = joined count
- `ccai:sig:heartbeat:gate-worker`

Check in Upstash console or:

```bash
# from any machine with redis-cli against Upstash, or use REST
```

---

## 7. Update procedure

```bash
cd /opt/cryptocheck
git pull
docker compose -p cryptocheck-signal -f deploy/docker-compose.signal.yml up -d --build
docker compose -p cryptocheck-signal -f deploy/docker-compose.signal.yml ps
```

Stop **only** signal workers:

```bash
docker compose -p cryptocheck-signal -f deploy/docker-compose.signal.yml down
```

---

## 8. Vercel Production corrections

Set in **Vercel → Settings → Environment Variables → Production**:

| Variable | Action |
|----------|--------|
| `SIGNAL_REALTIME_URL` | **DELETE / leave unset** — history reads Supabase natively |
| `NEXT_PUBLIC_SIGNAL_WS_URL` | **Not needed** in poll mode |
| `TXODDS_ENABLED` / `TXODDS_API_KEY` | **Leave unset** until TxODDS ingestion is deployed — avoids cosmetic "LIVE" chip |
| `SIGNAL_WORKER_SECRET` | Must match `deploy/.env.signal` |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for `/api/signals/history` Supabase reads |

Redeploy Vercel after env changes.

---

## 9. Verification checklist

Run after deploy. **Deploy is not done until all PASS.**

### 9.1 Droplet containers

```bash
docker compose -p cryptocheck-signal -f deploy/docker-compose.signal.yml ps
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'cryptocheck-signal|NAMES'
```

**PASS:** `cryptocheck-signal-ingestion-1` and `cryptocheck-signal-gate-1` are `Up`.  
Other project's containers unchanged.

### 9.2 Heartbeats fresh (< 45s)

Upstash → key `ccai:sig:heartbeat:telegram-monitor` → JSON with recent `ts` and `channels > 0`.

**PASS:** Both heartbeat keys exist with `ts` within last 45 seconds.

### 9.3 End-to-end signal

Post a test message in a monitored public channel (with a token CA if you want a scored row). Then in Supabase:

```sql
SELECT id, label, verdict, msg_timestamp, created_at
FROM signal_normalized
WHERE dropped = false AND sample = false
ORDER BY created_at DESC
LIMIT 5;
```

**PASS:** Row count increments after gate processes the message (~seconds to minutes depending on parse/scan).

### 9.4 History API

```bash
curl -s 'https://www.cryptocheckai.com/api/signals/history?limit=3' | jq .
```

**PASS:** Returns `{ "signals": [ ... ], "mode": "poll" }` with real data (free tier: 90s delay on `msg_timestamp`).

### 9.5 Dashboard

Open command center → **Data Sources** chip: Telegram **live** with real channel count.  
**Master Feed** populates within one poll cycle (~20s).

### 9.6 Production readiness

```bash
curl -s -H "Authorization: Bearer $SIGNAL_WORKER_SECRET" \
  'https://www.cryptocheckai.com/api/internal/production-readiness' | jq .signalNormalizedRows
```

**PASS:** `signalNormalizedRows > 0`

### 9.7 Resource headroom (after 30 min)

```bash
free -h
dmesg | tail -20 | grep -i oom || echo 'no OOM kills'
```

**PASS:** ≥ 200 MB free; no OOM killer entries for ingestion/gate.

---

## 10. Optional hardening

- **Monthly log/image prune:** `docker system prune -af --filter "until=720h"` (cron; verify it won't remove the other project's images)
- **unattended-upgrades** on Ubuntu for security patches
- **`restart: always`** in compose — containers survive droplet reboot
- **Never** run bare `docker compose down` on a shared host

---

## Supabase migrations

Apply in order if not already present:

1. `supabase/migrations/20260629_signal_aggregator_foundation.sql`
2. `supabase/migrations/20260702_multi_source_ingestion_foundation.sql`
3. `supabase/migrations/20260706_telegram_channels.sql`
4. `supabase/migrations/20260708_source_platform.sql`

---

## Architecture (reference)

```
Telegram channels
  → ingestion (droplet) → Redis ccai:sig:stream:unified
  → gate (droplet)      → signal_normalized (Supabase)
  → Vercel /api/signals/history (poll)
  → Dashboard Master Feed
```

Frozen scanner core and swap engine are **not** involved in this deploy path.
