# Signal Ingestion — Multi-Source (Prompt 1–2)

GramJS Telegram + TxLINE SSE → **normalize** → `UnifiedSignal` → unified Redis Stream.

## Architecture

```
TelegramAdapter (sourceTag: telegram)
  ├── telegram-gram-listener.ts   — GramJS, public channels only
  ├── parser/normalize-telegram.ts
  └── unified-stream.ts           — SETNX dedup + XADD per-source + unified

TxODDSAdapter (sourceTag: txodds)
  ├── txodds/sse-client.ts        — TxLINE SSE parser
  ├── txodds/auth.ts              — JWT + X-Api-Token
  ├── txodds/fixture-cache.ts     — fixture snapshot → team labels
  ├── txodds/normalize-txodds.ts  — scores + odds → match_event
  └── unified-stream.ts
```

## Streams

| Key | Payload |
|-----|---------|
| `ccai:sig:stream:source:telegram` | JSON `UnifiedSignal` |
| `ccai:sig:stream:source:txodds` | JSON `UnifiedSignal` |
| `ccai:sig:stream:unified` | JSON `UnifiedSignal` (gate — Prompt 3) |

## Setup

1. `cp .env.example .env` — Upstash Redis + source credentials
2. **Telegram:** `npm run auth` → `TELEGRAM_SESSION_STRING`; public channels in `config/channels.json`
3. **TxODDS:** World Cup activation → `TXLINE_API_TOKEN` (+ optional `TXLINE_JWT`); see [TxLINE World Cup tier](https://txline.txodds.com/documentation/worldcup)
4. `SIGNAL_SOURCES=telegram` or `telegram,txodds` or `txodds`
5. `npm run dev`

## UnifiedSignal ids

| Source | id | subjectType |
|--------|-----|-------------|
| Telegram | `telegram:{messageId}` | `token` |
| TxODDS | `txodds:{fixtureId}:{seq\|messageId}` | `match_event` |

`verdict = scanning` until gate enrich (Prompt 3).

## Health

```bash
curl -s http://localhost:4101/health | jq
```

## Contracts

`SourceAdapter`, `UnifiedSignal` from `@cryptocheck/signal-contracts` — zero `@/` imports.
