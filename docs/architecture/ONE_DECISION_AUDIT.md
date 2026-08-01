# ONE DECISION — Architectural Audit (before / after)

Sprint goal: exactly one opinion-shaped object (`Decision`) emitted only by the Decision Engine. Layer 1 engines remain separate and deployable; Layer 4 surfaces are read-only consumers.

Canonical schema: `@cryptocheck/decision-contracts` → `Decision`  
Sharding map: `ENGINE_SHARDING` (`global` vs `per_user`).

---

## Layer 1 — engines (facts / signals)

| Engine | Sharding | Audit | Fix |
|--------|----------|-------|-----|
| Market Intelligence | global | Soft: `predictionUpsidePct` / order-flow used as predictive signals — domain OK; act synthesis removed from attention market adapter | Market attention items no longer invent `recommendation` confidence-to-act |
| Security Scanner | global | Soft: `score-from-market.recommendedAction` was act-shaped | Relabeled as risk-band heuristics; Decision owns act |
| Whale Intelligence | global | Soft: `aiConfidence` is classification confidence (domain) — not Decision.action | Left as Layer 1 classification score; Discovery no longer ranks on it |
| Liquidity Engine | global | No independent act opinion found | — |
| Portfolio Intelligence | per_user | Soft: portfolio adapter prescribed “review / maintain” | Facts + evidence only; no act recommendation |
| Trader DNA | per_user | Soft: Coach “size down” without Decision | Coach discipline tone only when a Decision exists |

Engines remain independently deployable — no merge.

---

## Layer 2 / 3 — Decision Engine + Decision object

| Item | Before | After |
|------|--------|-------|
| Schema | `ExplainableDecision` / `OpportunityScore` ad hoc | Canonical `Decision` in `@cryptocheck/decision-contracts` + `toCanonicalDecision` |
| Degraded inputs | Silent / full confidence | `unavailableEngines` penalty; `Decision.degraded` + `degradedInputs` |
| Entry for consumers | Direct `decide` + `buildMarketIntel` in Layer 4 | `decideForToken` / `useCanonicalDecision` / `TradeLikeMeState.canonicalDecision` |
| Orchestrator | No unavailable-engine accounting | Passes `trader-dna` / `whale-intelligence` / `portfolio-intelligence` degradation; status line notes degraded |
| Persistence | Degraded lost when remapping from ExplainableDecision | `ExplainableDecision.degraded` + `degradedInputs` survive → `toCanonicalDecision` |

---

## Layer 4 — surface audits

### Chart (AI layer) — `features/intelligence-chart`
- **Found:** VIOLATION — `assemble-chart-bundle` called `decide(null, intel)` and OR’d buy/sell zones with `expectedRoiPct` / `whaleBias` (shadow opinion).
- **Fixed:** Uses `decideForToken` → canonical `Decision`; zones only when `Decision.action` is BUY / SELL / EXIT; strip/timeline trend from price change fact, not prediction upside.

### Coach — `features/terminal-os/ai-coach` + `/api/terminal-os/coach`
- **Found:** VIOLATION — DNA “size down until discipline recovers” without Decision.
- **Fixed:** DNA facts always; actionable tone only downstream of `currentOpportunity` / Decision reasons.

### Gateway / Money Lifecycle — `features/terminal-os/money-lifecycle`
- **Found:** No violation — Stage 5 reads `currentOpportunity` / `lastDecision`.
- **Follow-up:** Stage 5 headline/detail surfaces `Decision.degraded` when present (still no independent scoring).

### Swap / Execution — `features/execution-desk` + Simple Execution workspace
- **Found:** VIOLATION — Secure Execution unbound from Decision (`SwapDecision` risk gate only).
- **Fixed:** `useCanonicalDecision` bind line; builder math / risk-gate unchanged (deterministic, not opinion). Simple Execution already gated on Decision action.

### Alerts — `features/terminal-os/alerts`
- **Found:** No scoring duplication — rules evaluate price / thresholds; unwired to Decision state changes (acceptable for L1 thresholds).
- **Fixed:** n/a (documented clean). Future: optional Decision-change rules.

### Discovery — `features/terminal-os/discovery-engine` + Attention discovery workspace
- **Found:** VIOLATION — invented `opportunityScore` via `scoreTokenFromMarket`; Attention discovery included `market-intelligence`.
- **Fixed:** DiscoveryPanel maps tokens through `decideForToken`, sorts by `Decision.confidence`; Attention discovery filter = `decision-engine` only.

---

## Enforcement

- `npm run lint:decision-boundary` — fails if Layer 4 imports banned Layer 1 modules.
- `npm run test:decision-boundary` — degraded Decision + lint smoke.

---

## Definition of Done checklist

- [x] Canonical `Decision` schema package
- [x] Layer 4 audits documented with violations + fixes
- [x] Degraded-input Decision verified by test
- [x] Lint blocks Layer 4 → Layer 1 imports
- [x] Layer 1 engines not merged
- [x] Global vs per-user sharding explicit in `ENGINE_SHARDING`
