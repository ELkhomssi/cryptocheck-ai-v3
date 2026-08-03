# AI Gateway Refinement — Audit & Iteration Log

## 0. Pre-build audit (2026-08-03)

### Reuse confirmed (not a rebuild)
| Surface | Status |
|---------|--------|
| `IntelligenceSwap` (PR #81 / moat) | Restored into branch — Jupiter + `/api/revenue/quote` + `assess-swap` + OMS prepare + `ExecutionState` |
| Canonical `Decision` | `@cryptocheck/decision-contracts` + Redis store + `/api/terminal-os/decisions` |
| Terminal OS shell | Remains `TerminalOsShell` (PR #85 foundation) — Gateway mounts *inside* it |
| Frozen scanner / decision-engine scoring | Unchanged — presentation reads Decisions only |

### Gaps vs target Gateway layout (presentation only)
| Stage | Before | After plan |
|-------|--------|------------|
| Market | Chart/tickers elsewhere | Keep; Gateway focuses Decision for focused token |
| AI Thinking | Missing | Show Decision load / freshness from real fetch state |
| Decision.action | Not in swap strip | Hero typography |
| Reasoning + factors | reasoning only | + contributingFactors as sources |
| Confidence | single number | market vs personalized per schema |
| Risk | shown | keep + emphasize |
| Expected Reward | missing in strip | expectedROI / expectedDrawdown |
| Execution | full machine present | keep cost + signature + security floor |

### Do not touch
Decision Engine logic, Layer 1 engines, executeSwap / Jupiter / assess paths — presentation/CSS/layout only.

---

## Iterations (max 5)

### Iteration 1 — Hierarchy / centerpiece
**Change:** Mount existing `IntelligenceSwap` as **AI Gateway** at the top of Terminal OS home (+ AI Trading nav). Dark `[data-tos]` token mapping via `gateway-tos.css`. Label → “AI Gateway”.
**Why:** Swap was unmounted after foundation restore; Gateway must be the visual centerpiece without replacing `TerminalOsShell`.
**Checks:** Cost block present; execute path unchanged; page still `TerminalOsShell`.

### Iteration 2 — Full Decision schema strip
**Change:** Present `action` (hero), `reasoning`, `confidence` + market/personalized split, `risk`, `expectedROI`/`expectedDrawdown`, `contributingFactors` as AI Sources — all from real `Decision`.
**Why:** Strip previously omitted action / ROI / factors; schema already had them.
**Checks:** No hardcoded confidence; values from `decision.*` only.

### Iteration 3 — Spacing / glass / cost prominence
**Change:** Glass card, stronger gap, gold cost value emphasis in `gateway-tos.css`.
**Why:** Cost must read as the pre-execute safety floor, not a footnote.
**Checks:** “Estimated total cost” + platform fee + impact/slippage still rendered before Execute.

### Iteration 4 — Accessibility / touch targets
**Change:** min-height 44px on Execute, override, token buttons, flip; `:focus-visible` uses `--tos-shadow-focus`.
**Why:** Execute was below 44px touch target on desktop chrome.
**Checks:** Keyboard focus ring; security modal / HIGH_RISK / BLOCKED paths untouched.

### Iteration 5 — AI Thinking status (real fetch state)
**Change:** Show computing / idle+published time / waiting from `decisionLoading` + `decision.computedAt` (no fake progress).
**Why:** Target layout requires “AI Thinking” without inventing engine telemetry.
**Checks:** Status strings only reflect fetch/Decision timestamps; no fake “scanned N tokens” counters.

### Stop
Objective checks green via `__tests__/ai-os/gateway-presentation.test.ts`. Subjective premium/trust judgment → **human checkpoint** below (not self-certified).

---

## Human checkpoint (required)
Please review production/preview `/terminalOS` and answer:
1. Would a hedge-fund trader trust this Gateway as the primary decision surface?
2. Does hierarchy answer “what should I do?” in under 3 seconds?
3. Any remaining concrete visual weakness (specific, not vibe)?
