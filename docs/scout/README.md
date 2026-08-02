# Scout V2 — Autonomous Growth Intelligence Agent

Scout is CryptoCheckAI’s Growth Intelligence Agent. It does **not** invent market analysis
and does **not** write generic crypto blogs. It researches, scores, writes, SEO-audits,
auto-publishes, distributes, and learns — always reinforcing the Terminal OS ecosystem.

## Mission

Increase SEO authority, organic traffic, Terminal OS adoption, and AI Gateway adoption by
publishing educate-first intelligence that makes readers want to try Terminal OS.

## Rules (summary)

1. **Ecosystem only** — Terminal OS, Intelligence Chart, AI Gateway, Coaching, Trade Like Me, Portfolio Intelligence, Secure Execution, Security Scanner, Discovery Engine.
2. **Research every few hours** — market feeds, Market Analyst, scan-gateway (+ pillar seeds).
3. **Priority threshold** — default `SCOUT_PRIORITY_THRESHOLD=62`; below threshold = no publish.
4. **Full SEO package** — title, meta, slug, JSON-LD, OG, Twitter, canonical, FAQ, internal links, keywords.
5. **Educate first** — problem → tool failure → professionals → CryptoCheckAI → Terminal OS → visuals → CTA.
6. **Institutional voice** — no clickbait, no profit promises, no hype.
7. **Auto-publish** — default on after quality gates (`SCOUT_AUTO_PUBLISH=0` to require approval).
8. **Multi-channel** — LinkedIn, X thread, newsletter, Reddit, Discord, Telegram, short summary.

## Pipeline

Research → Priority score → Keywords → Plan → Write → SEO → Quality (fact / dup / hype / structure) → Publish → Sitemap / IndexNow → Distributions → Learning

## Engine sources (allowed)

- `lib/terminal/market-feeds.ts` — trending / new launches
- `lib/portfolio-desk/market-analyst.ts` — daily brief
- `lib/connect/scan-gateway.ts` — mint risk (`assessRiskByMint`)
- `lib/scout/strategy.ts` — ecosystem pillar seeds

Never import frozen scanner core.

## Surfaces

| Surface | Path |
|---------|------|
| Terminal OS desk | `/terminalOS` → **Scout** nav |
| Status API | `GET /api/scout/status` |
| Run cycle | `POST /api/scout/run` (operator / `SCOUT_RUN_SECRET`) |
| Approve publish | `POST /api/scout/approve` (when auto-publish off) |
| Cron | `GET /api/cron/scout-cycle` (every 3h) |
| Blog | `/blog`, `/blog/[slug]` |

## Env

| Variable | Default | Meaning |
|----------|---------|---------|
| `SCOUT_AUTO_PUBLISH` | on (unset) | Set `0` for manual approval |
| `SCOUT_PRIORITY_THRESHOLD` | `62` | Minimum priority to write/publish |
| `INDEXNOW_KEY` | — | Optional IndexNow notify |
| `CRON_SECRET` | required | Cron auth |
| `SCOUT_RUN_SECRET` | optional | Manual run auth |

## Redis / Supabase

- Redis: `ccai:scout:*`
- Tables: `scout_articles`, `scout_distributions`, `scout_dashboard_snapshots`, `scout_learning_signals`

## Metrics (wired later)

Slots exist for GSC impressions/clicks/CTR/position, organic users, accounts created, wallet connections, Terminal OS sessions, revenue influenced. Until wired, `metrics.sample === true`.

## Operator flow

1. Open Terminal OS → **Scout**
2. Confirm mode **AUTO-PUBLISH** (or set `SCOUT_AUTO_PUBLISH=0`)
3. **Run research cycle** or wait for cron
4. Articles that pass quality appear on `/blog/{slug}` and in `/sitemap.xml`
