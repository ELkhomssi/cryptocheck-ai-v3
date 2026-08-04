# AI Gateway Refinement — Audit & Iteration Log

## 0. Pre-build audit (2026-08-03)

### Reuse confirmed (not a rebuild)
| Surface | Status |
|---------|--------|
| `IntelligenceSwap` (PR #81 / moat) | Restored into branch — Jupiter + `/api/revenue/quote` + `assess-swap` + OMS prepare + `ExecutionState` |
| Canonical `Decision` | `@cryptocheck/decision-contracts` + Redis store + `/api/terminal-os/decisions` |
| Terminal OS shell | Remains `TerminalOsShell` (PR #85 foundation) — Gateway mounts *inside* it |
| Frozen scanner / decision-engine scoring | Unchanged — presentation reads Decisions only |

### Do not touch
Decision Engine scoring, Layer 1 engines, executeSwap / Jupiter / assess paths — presentation/CSS/layout only.

---

## First refinement loop (PR #86 base — iterations 1–5)

Logged previously: mount centerpiece → full Decision strip → glass/cost → 44px a11y → AI Thinking from fetch state.

---

## Evolution loop (CORRECTED) — max 5 iterations

Concrete weaknesses (not scores):
1. DOM order did not match Decision → Confidence → Reasoning → Risk → Expected Return → Execution.
2. Decision typography competed with amount input (~1.65rem).
3. Sources + four metrics inflated above-fold cognitive load.
4. Liveliness labels incomplete; risk of decorative stages.
5. Spoken summary must use real tick counts — never “12,431”-style fiction.

### Evolution iteration 1 — Hierarchy
**Change:** Reorder Decision strip DOM to Decision → Confidence → Reasoning → Risk → Expected Return; grow `.aios-gw-action` to `clamp(2.5rem…3.35rem)`; shrink amount to `1.2rem`.
**Why:** Decision must be unambiguously largest/highest-contrast; amount was competing.
**Checks:** CSS size inequality Decision ≫ amount/confidence; DOM order test.

### Evolution iteration 2 — Real liveliness states
**Change:** `gatewayPhase` / `phaseLabel` in `features/ai-os/lib/gateway-phase.ts` — Thinking / Analyzing / Comparing / Validating / Decision Ready mapped only to `decisionLoading`, `quoteLoading`, `execState === 'simulating'`. Cached Decision → Decision Ready immediately (no fake delay).
**Why:** Alive states must reflect real pipeline stages.
**Checks:** Unit tests for each phase mapping; no `setTimeout` stage theater.

### Evolution iteration 3 — Spoken summary from real run counts
**Change:** Persist `DecisionTickMeta` (`ccai:tos:decision:tick:meta`) from `decision-engine-tick` (`scanned`, `published`, `buyCount`, `waitCount`); expose via `/api/terminal-os/decisions` as `tickMeta`; Gateway `spokenSummary` returns null unless `scanned > 0`.
**Why:** Plain-language voice must pull actual cycle counts.
**Checks:** spokenSummary(null/0) → null; template uses meta fields only.

### Evolution iteration 4 — Cognitive load + Execute secondary
**Change:** Collapse AI sources into `<details>`; `data-primary-budget="7"`; soften Execute (smaller type, no glow) so it stays present but secondary to Decision.
**Why:** Above-fold element budget; primary-action hierarchy is Decision, not the button competing with it.
**Checks:** sources collapsed by default; Execute font ≤ Decision.

### Evolution iteration 5 — Objective proxies + safety re-verify
**Change:** Expand `__tests__/ai-os/gateway-presentation.test.ts` for hierarchy, phase honesty, tickMeta wiring, safety strings; document keyboard path below.
**Why:** Replace self-scored “trust 9.7” with machine-checkable proxies; re-confirm safety floor before human checkpoint.
**Checks:** See § Objective checks.

### Stop
Reached iteration 5. No further *specific, nameable* presentation weakness identified beyond subjective trust/premium. **Ship decision is human-only** (checkpoint below).

---

## Objective checks (§5 proxies)

| Proxy | Result |
|-------|--------|
| Decision largest/highest-contrast | CSS: action `clamp(2.5rem…3.35rem)` / extrabold / primary or valence color; amount `1.2rem`; confidence ≤ `1.55rem` — asserted in tests |
| WCAG AA contrast | Uses TOS institutional tokens (`--tos-text-primary`, gold/pos/neg on dark glass). Full pixel AA audit → human/preview |
| Cognitive load ≤7 primary above fold | Phase, Decision, spoken (opt), Confidence, Reasoning, Risk/Return, sources summary (collapsed). `data-primary-budget="7"` |
| Keyboard decision→execution | Tab path: sources summary (optional) → sell token → amount → flip → buy token → (override if HIGH_RISK) → Execute. ≤7 stops when sources closed & no override. Focus-visible rings retained |
| Safety floor (final) | Still present: “Estimated total cost”, `wallet.signTransaction`, BLOCKED gate, `DangerAcknowledgeModal` / OVERRIDE — asserted in tests. No Decision Engine / Layer 1 / executeSwap logic edits in this loop |
| Trust / Premium | **Human checkpoint — not agent-graded** |

---

## Human checkpoint (required — ship / one more scoped round)

Review preview `/terminalOS` AI Gateway and answer:

1. Would a hedge-fund trader trust this as the primary decision surface?
2. Does it answer “what should I do?” in under ~3 seconds (primary Decision line)?
3. Any remaining **concrete, nameable** visual weakness (not “could feel more premium”)?

Agent must **not** self-certify ship on a numeric score.
