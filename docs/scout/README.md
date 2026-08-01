# Scout — Growth Intelligence Operating System

Scout is CryptoCheckAI’s AI Growth Employee. It does **not** invent market analysis.
It transforms live engine outputs into SEO content, distribution drafts, and learning loops.

## Pipeline

Internet / feeds → Trend Hunter → Keyword Intelligence → Content Planner → Writer → Quality Review → Publisher (approval) → SEO → Analytics → Learning

## Engine sources (allowed)

- `lib/terminal/market-feeds.ts` — trending / new launches
- `lib/portfolio-desk/market-analyst.ts` — daily brief
- `lib/connect/scan-gateway.ts` — mint risk (`assessRiskByMint`)

Never import frozen scanner core.

## Surfaces

| Surface | Path |
|---------|------|
| Terminal OS desk | `/terminalOS` → **Scout** nav |
| Status API | `GET /api/scout/status` |
| Run cycle | `POST /api/scout/run` (operator / `SCOUT_RUN_SECRET`) |
| Approve publish | `POST /api/scout/approve` |
| Cron drafts | `GET /api/cron/scout-cycle` (every 6h) |
| Blog | `/blog`, `/blog/[slug]` |

## Redis / Supabase

- Redis: `ccai:scout:*`
- Tables: `scout_articles`, `scout_distributions`, `scout_dashboard_snapshots`, `scout_learning_signals`

## Rules

- Search volumes stay `null` until a real SEO provider is wired (no fabrication).
- Publishing is approval-based (`SCOUT_AUTO_PUBLISH=1` to override).
- Quality gates must pass before approval.
- After approve, Scout best-effort notifies IndexNow (if `INDEXNOW_KEY`) and pings the sitemap URL.

## Operator flow

1. Open Terminal OS → **Scout**
2. **Run research cycle** (operator session or `SCOUT_RUN_SECRET`)
3. Review queue — quality-blocked drafts cannot publish
4. **Approve & publish** → live at `/blog/{slug}` and included in `/sitemap.xml`
