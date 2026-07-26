# Phase 17 — Intelligence Core

One orchestration layer at `lib/intelligence-core/`. Does **not** rewrite Phases 10–16.

## New tables only

1. `timeline_events` — DB triggers on `agent_activity`, `portfolio_alerts`, `terminal_orders`
2. `user_memory` — interaction history
3. `reports` — persisted briefs

Apply: `supabase/migrations/20260726_intelligence_core.sql`

## Engines

See `lib/intelligence-core/README.md`.

## APIs

- `GET /api/intelligence-core/mission`
- `GET /api/intelligence-core/timeline`
- `GET|POST /api/intelligence-core/memory`
- `GET /api/intelligence-core/context?kind=trading|coach`
- `GET|POST /api/intelligence-core/reports`

## Tests / lint

```bash
npm run test:intelligence-core
npm run lint:intelligence-core
npm run lint:ai-voice
```

## Mission Control

Data plumbing via MissionEngine. Visual design of original five sections unchanged; **Recommendations** and **Daily Brief** added.
