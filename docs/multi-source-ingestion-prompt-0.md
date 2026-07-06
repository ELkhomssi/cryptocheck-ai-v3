# Multi-Source Ingestion — collision & scale strategy (Prompt 0)

## Id keys

| Layer | Key | Purpose |
|-------|-----|---------|
| UnifiedSignal.id | `{sourceTag}:{sourceRef}` | Global dedup, Redis cache, feed row id |
| Postgres | `UNIQUE (source_tag, source_ref)` | Idempotent persist across replays |
| Redis SETNX | `ccai:sig:dedup:id:{id}` | Drop duplicate packets at ingest (TTL ≈ 120s) |

## Streams

```
TelegramAdapter ──XADD──► ccai:sig:stream:source:telegram ──┐
                                                              ├── fan-in ──► ccai:sig:stream:unified
TxODDSAdapter   ──XADD──► ccai:sig:stream:source:txodds   ──┘
                                      │
                                      ▼
                         consumer group ccai:sig:cg:gate
                         (horizontal workers, exactly-once per message)
```

- **Per-source streams**: burst isolation + per-source `MAXLEN` trim.
- **Unified stream**: single gate dispatch; one consumer group for enrichment.
- **Legacy path** (`ccai:sig:stream:raw` → parser → parsed) remains until Prompt 1 migrates Telegram to `SourceAdapter`.

## Gate dispatch (Prompt 3) ✅

| subjectType | Evaluator | Swap path |
|-------------|-----------|-----------|
| `token` | Existing scan gateway / Sentinel (frozen core untouched) | Yes — unchanged risk-gated Jupiter |
| `match_event` | `SportsSignalEvaluator` (odds/edge only) | **No** — render only (`verdict: n/a`) |

Worker: `services/pipeline` → `npm run dev:gate` (consumer group `ccai:sig:cg:gate`).

Downstream feed + realtime are **source-agnostic**; they consume `UnifiedSignal` + `UnifiedVerdict` only.

## Sentinel Edge (Prompts A–D)

| Prompt | Surface |
|--------|---------|
| A | `SportsSignalEvaluator` → `EdgeSignal` |
| B | `AgentEngine` (opt-in, caps, kill-switch) |
| C | Memo / paper proof + `verify()` + backtest |
| D | `/dashboard/signals/agent` dashboard |

## Master Feed UI (Prompt 4) ✅

- Source chips: **All / Telegram / TxODDS** (open on free tier)
- Subject chips: **All types / Tokens / Sports**
- Polymorphic rows: token → Safe Swap; `match_event` → Info only (`verdict: n/a`)
- Token-only filters (chain, min verdict, min sources) remain premium-gated

## Package surface

- Types: `packages/signal-contracts/src/unified-ingestion.ts`
- `SourceAdapter`, `UnifiedSignal`, stream key helpers
- Migration: `supabase/migrations/20260702_multi_source_ingestion_foundation.sql`
