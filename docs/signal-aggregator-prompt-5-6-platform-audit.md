# Signal Aggregator — Platform Audit (Prompts 5 & 6)

**Scope:** What was added to the CryptoCheck platform in **Prompt 5** (Master Feed UI + row-level Safe Swap) and **Prompt 6** (Freemium/auth, PWA push, billing, final safety pass).

**Date:** 2026-06-30  
**Base path:** `/dashboard/signals`  
**Does not modify:** frozen scanner core

---

## Prompt 5 — Master Feed UI + Safe Swap

### User-facing surface

| Item | Path | Purpose |
|------|------|---------|
| Master Feed page | `app/dashboard/signals/page.tsx` | Main feed route |
| Signals layout | `app/dashboard/signals/layout.tsx` | Syncopate + JetBrains Mono fonts, `rd.*` design tokens, PWA manifest link |
| Dashboard shell bypass | `components/Dashboard/DashboardShell.tsx` | Skips default dashboard chrome for `/dashboard/signals/*` |

### UI components (`components/signals-dashboard/`)

| Component | Role |
|-----------|------|
| `SignalDashboardShell.tsx` | Navy/green shell, wallet pill, mobile nav |
| `MasterFeed.tsx` | Orchestrates history, WebSocket, filters, swap sheet |
| `MasterFeedVirtualList.tsx` | `react-window` virtualized table (~72px rows) |
| `SignalFeedRow.tsx` | Token, CA, sources, type, price, age, verdict chip, **Safe Swap** button |
| `SignalFeedFilters.tsx` | Chain, verdict, min sources, search (server-side subscription) |
| `SignalSwapSheet.tsx` | Bottom sheet (mobile) / modal (desktop) — Jupiter swap flow |

### Client libraries (`lib/signals-dashboard/`)

| Module | Role |
|--------|------|
| `use-signal-feed.ts` | History via `/api/signals/history` + live WebSocket |
| `format.ts` | CA truncation, age, verdict CSS, `canSwapSignal()` |
| `constants` (re-export) | `signalWsUrl()`, `SIGNAL_AMOUNT_PRESETS_USD` in `lib/signal-aggregator/constants.ts` |

### API (same-origin proxy)

| Route | Method | Role |
|-------|--------|------|
| `app/api/signals/history/route.ts` | GET | Proxies to realtime gateway `/v1/history` |

### Swap integration (reuses existing engine — not rebuilt)

| Integration | Existing path |
|-------------|---------------|
| Jupiter quote | `POST /api/revenue/quote` |
| Risk gate | `POST /api/revenue/assess-swap` → `lib/trading/risk-gated-swap.ts` |
| Simulate + sign | `simulateSerializedSwapTransaction`, `buildJupiterSwapTransaction` |
| DANGER gate | `DangerAcknowledgeModal` (typed confirmation) |
| Fee ledger | `POST /api/revenue/record-fee` with optional `signalId` |
| Compliance | `RevenueComplianceNote`, `SIGNAL_COMPLIANCE` copy on feed |

### Dependencies added

- `react-window` + `@types/react-window` — virtualization

### Behaviour shipped

- Initial load from Postgres history API; incremental updates via WebSocket (no polling)
- Server-filtered subscription (`subscribe` message with filter object)
- New rows highlight briefly; hover/focus pauses auto-advance
- `scanning` verdict shows pulse chip; updates flip in place
- Safe Swap: SOL → token; amount presets $25/$50/$100/$250; platform fee line item
- Deep links: `?signalId=…&mint=…` opens pre-filled swap sheet
- Non-Solana rows: swap button disabled (MVP scanner is Solana-only)

---

## Prompt 6 — Freemium, billing, push, audit

### Subscription & billing

| Item | Path | Purpose |
|------|------|---------|
| Subscription service | `lib/signal-aggregator/subscription.ts` | Tier resolution, premium upsert, PaymentIntent fulfill, push subs |
| Audit checklist | `lib/signal-aggregator/audit.ts` | Machine-readable pass/fail for all 8 audit points |
| FeeRecord extension | `lib/revenue-dashboard/types.ts` | Optional `signalId` on fee rows |
| Record-fee API | `app/api/revenue/record-fee/route.ts` | Accepts `signalId` in POST body |

### API routes (`app/api/signals/` + internal)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/signals/subscription` | GET | Session | Current tier, merchant wallet, price for UI |
| `/api/signals/subscribe` | POST | Session | Payment envelope (`signals_premium:{userId}` memo) |
| `/api/signals/subscribe/fulfill` | POST | Session | Confirm PaymentIntent → `signal_subscription` premium |
| `/api/signals/push/subscribe` | POST | Session + premium | Store Web Push subscription |
| `/api/signals/vapid-public-key` | GET | Public | VAPID key for browser push |
| `/api/internal/signals/tier` | GET | Worker secret | Gateway tier bridge by `userId` |
| `/api/internal/signals/push-dispatch` | POST | Worker secret | Send SAFE alerts to premium push subs |

### Freemium enforcement (server-side)

| Tier | Gateway (`services/realtime`) | UI |
|------|------------------------------|-----|
| **free** | 90s delay, SAFE-only, `sourceCount ≥ 2`, max 25 history rows | Filters disabled in `SignalFeedFilters` |
| **premium** | Real-time, full filters, max 200 history rows | PayWidget upgrade or existing Pro/Enterprise tier |

**Premium granted when:**
1. `signal_subscription.tier = premium` (paid via CCAI Pay), or
2. Consumer tier is Pro / Elite / Enterprise / Micropack, or
3. Bearer `SIGNAL_PREMIUM_TOKEN` (dev)

**Realtime tier bridge:** `services/realtime/src/lib/tier-remote.ts` calls `/api/internal/signals/tier`

### PWA push

| Asset | Path |
|-------|------|
| Service worker | `public/sw-signals.js` |
| Web manifest | `public/signals.webmanifest` |
| Client registrar | `lib/signals-dashboard/push-client.ts` |
| UI trigger | `SignalsPremiumCard` → “Enable SAFE alerts” |

**Flow:** Premium user grants notification permission → push subscription saved to `signal_push_subscription` → enrich worker calls push-dispatch on **SAFE** resolved signals → notification deep-links to swap sheet.

### Database migration

| Migration | Table |
|-----------|-------|
| `supabase/migrations/20260630_signal_push_subscriptions.sql` | `signal_push_subscription` |

(Uses existing `signal_subscription` from Prompt 0 foundation.)

### Worker change

| File | Change |
|------|--------|
| `services/pipeline/src/enrich/push-dispatch.ts` | HTTP call to push-dispatch API |
| `services/pipeline/src/enrich/processor.ts` | Dispatches push after SAFE enrichment |

### Dependencies added

- `web-push` + `@types/web-push` — server-side VAPID push

### UI addition

| Component | Role |
|-----------|------|
| `SignalsPremiumCard.tsx` | Upgrade via `PayWidget`; push enable for premium |
| `use-signal-subscription.ts` | Fetches `/api/signals/subscription` |
| `MasterFeed.tsx` (updated) | Wires subscription, `userId` on WS/history, Terms/fee footer links |

---

## Safety & integrity audit (Prompts 5 & 6)

| Check | Pass | Evidence |
|-------|------|----------|
| **Reuse — scans** | ✅ | Swap sheet does not call scanner directly; feed data from enrich worker (gateway assess) |
| **Reuse — swaps** | ✅ | `SignalSwapSheet` → `/api/revenue/quote`, `/api/revenue/assess-swap`, Jupiter client only |
| **Frozen core** | ✅ | No edits to `scanner-engine.ts`, `run-institutional-scan.ts`, `canonical-scan.ts` |
| **Money safety** | ✅ | Simulate before send; fee line item; DANGER modal; non-custodial wallet sign |
| **Integrity** | ✅ | Feed excludes `dropped` and `sample` rows in UI; no fabricated counts |
| **Freemium not client-only** | ✅ | Delay + filter caps enforced in `services/realtime` (`WsClientSession`, `fetchHistory`) |
| **Compliance** | ✅ | `SIGNAL_COMPLIANCE` on feed header; Terms + fee disclosure footer links |
| **Accessibility** | ✅ | `aria-label` on swap/close; focus rings; `motion-safe:` on animations; 360px bottom sheet |

---

## Environment variables (Prompts 5 & 6)

```bash
# Prompt 5 — feed UI
NEXT_PUBLIC_SIGNAL_WS_URL=ws://localhost:4102
SIGNAL_REALTIME_URL=http://localhost:4102
NEXT_PUBLIC_SIGNAL_PREMIUM_TOKEN=   # optional dev premium

# Prompt 6 — billing & push
SIGNAL_PREMIUM_PRICE_USD=29
SIGNAL_PREMIUM_MERCHANT_WALLET=     # defaults to PLATFORM_WALLET
SIGNAL_WORKER_SECRET=               # enrich → push-dispatch, tier API
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:support@cryptocheckai.com
```

---

## What was NOT added (explicit non-goals)

- No forex / pre-market surfaces
- No new scanner scoring path
- No custodial wallet or auto-trading
- No client-side-only paywall (free tier bypass requires server access, not UI toggle alone)
- PWA push requires VAPID keys; gracefully no-ops if unset

---

## Quick verification

```bash
# UI
open http://localhost:3000/dashboard/signals

# APIs
curl http://localhost:3000/api/signals/subscription
curl 'http://localhost:4102/v1/history?limit=5'

# Typecheck
npx tsc --noEmit
```

Programmatic audit: `lib/signal-aggregator/audit.ts` → `SIGNAL_AGGREGATOR_AUDIT`, `allAuditChecksPass()`
