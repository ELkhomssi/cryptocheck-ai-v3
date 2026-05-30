# Scanner coupling delta (Phase 0 → Sprint 1)

**Updated:** 2026-05-29 (Sprint 1 — Institutional Scan path)

## Executive result

| Metric | Phase 0 | Pre-Sprint 1 | Sprint 1 | Delta |
|--------|---------|--------------|----------|-------|
| External files importing `@/lib/services/scanner*` | 28 | 17 | **~10** | **−18 vs Phase 0** |
| Scan Gateway | missing | ✅ | ✅ | landed |
| `@cryptocheck/types` | missing | missing | ✅ | landed |
| Fast pipeline (`depth=fast`) | flag only | flag only | ✅ true fast path | landed |
| Async canonical | sync block | sync block | ✅ fire-and-forget | landed |
| B2B read-first reputation | missing | missing | ✅ | landed |

**Verdict:** Sprint 1 closes the Institutional Scan **latency and decoupling** gaps. Remaining importers are lib glue (`scan-cache`, `scan-request-security`, `platform-scan-api`, `merge-canonical`, `solana/connection`) — not UI.

---

## Wins (no longer import scanner-engine / scanner types directly)

| File | Replacement |
|------|-------------|
| `app/pro/dashboard/pro-dashboard-client.tsx` | `@cryptocheck/types` |
| `components/pro/institutional/*` (8 files) | `@cryptocheck/types` |
| `components/pro/LiveScoreDisplay.tsx` | `@cryptocheck/types` |
| `lib/types/institutional-scan-api.ts` | `@cryptocheck/types` |
| `lib/services/reasoning-cache.ts` | `@cryptocheck/types` |
| `lib/services/audit-report.service.ts` | `@cryptocheck/types` |
| `lib/cache/scan-cache.ts` | `@cryptocheck/types` |
| `app/api/v1/scan/*` routes | `scanViaGateway` only |

---

## Remaining work (acceptable internal coupling)

| File | Imports | Next step |
|------|---------|-----------|
| `lib/sentinel/merge-canonical-institutional.ts` | `institutionalSafetyGrade` from engine | Extract grade fn to types/utils (optional) |
| `lib/types/platform-scan-api.ts` | `risk-assessment` | Move `RiskAssessment` to `@cryptocheck/types` |
| `lib/api/scan-request-security.ts` | `ScanServiceError` | Re-export from gateway |
| `lib/solana/connection.ts` | `RpcProviderManager` | `lib/rpc/solana-connection.ts` wrapper |
| `lib/services/scanner/*` (internal) | engine | Expected — frozen core |

---

## Gate for “Institutional Scan done”

```bash
npm run audit:post-migration
npm run verify:all-phases
```

Target: external importers ≤ **6**, B2B fast P50 ≤ **150ms** warm, Task 3 includes `types` package.
