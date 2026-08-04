# AI Gateway Refinement — Round 2 Log

## Dependency check (§0)

| Dependency | Status |
|------------|--------|
| Decision snapshot history (`ccai:tos:decision:hist:{id}`) | **YES** — persisted on every `saveDecision`; API `?history=1` |
| `Decision.computedAt` / `staleAfter` | **YES** — on schema |
| Confidence sparkline UI | Was unwired — Round 2 wires real history (≥2 points) or honest “Building confidence history” |
| ENS / stored profile name helper | No ENS resolver; truncated `walletLabel` rejected as display name |
| TraderDNA `avgHoldingMs` | **YES** via `/api/terminal-os/dna` when `sampleSize ≥ 3` |

---

## Iterations (max 5) — IA / proactivity only

### Iteration 1 — Proactive greeting
**Change:** `buildGatewayGreeting` + mount at Gateway open; real `tickMeta.scanned` / `buyCount`; portfolio line only when holdings loaded; honest “Still gathering…” when no cycle.
**Why:** Passive waiting → AI initiates with real session counts.
**Checks:** No hardcoded personal name; address labels never used as `{displayName}`.

### Iteration 2 — One hero Decision + Decision → Reason → Approve → Execute
**Change:** `selectHeroDecision` from `/api/terminal-os/decisions` list; `GatewayHeroFlow` sequence; swap rows unlock only after Approve (`missionApproved`).
**Why:** First look must be one Decision; progressive disclosure like AttentionCard.
**Checks:** Evidence collapsed; Execute gated; cost still before Execute when unlocked.

### Iteration 3 — Confidence age / freshness / trend
**Change:** Fetch `history=1`; show age + freshness always; Sparkline only when ≥2 history points; else “Building confidence history”.
**Why:** Confidence beyond a bare number without fabricating a trend.
**Checks:** Uses real `computedAt` / `staleAfter` / hist confidence series.

### Iteration 4 — Per-engine checklist
**Change:** `engineChecklist` from `contributingFactors` + `degradedInputs` (Security / Momentum / Whales / DNA / Portfolio).
**Why:** Replace generic phase labels with real Layer 1 contribution status.
**Checks:** Degraded engines show unavailable (—), never fake ✓.

### Iteration 5 — Mission Summary + Holding honesty + safety re-verify
**Change:** Mission Summary maps Decision fields; Holding from DNA `avgHoldingMs` or omitted; tests + this log; human checkpoint.
**Why:** Approve step before Execute; no placeholder hold time.
**Checks:** Safety floor strings intact; zero Decision Engine / Layer 1 / tx logic edits; no Round 1 typography/spacing/glass retune.

### Stop
Iteration 5 reached. Subjective trust → **human checkpoint** below.

### Continuation (cold review — still within Round 2 IA scope)
**Finding:** Full engine checklist + confidence block sat above/beside the Decision and competed with the Decision → Reason → Approve first look.
**Change:** Engines expand only while computing; when ready, one “Decision Ready · age · freshness” line, then Decision hero. Confidence sparkline + full engine list move into Evidence.
**Why:** §2/§3 — one Decision must win the first look after greeting; engines/confidence remain real, just progressive.
**Checks:** Tests assert Decision → Reason → Mission → Approve order; engines-in-Evidence when ready.

---

## Human checkpoint (required before merge)

1. Would a hedge-fund trader trust this as the primary decision surface?
2. Does it answer “what should I do?” in under ~3 seconds?
3. Any remaining **concrete, nameable** visual/IA weakness?

Agent does not self-certify ship.
