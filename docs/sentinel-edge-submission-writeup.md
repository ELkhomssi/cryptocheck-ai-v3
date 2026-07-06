# Sentinel Edge — submission writeup  
### Trading Tools & Agents · TxLINE / transparency track

---

## One-liner

**Sentinel Edge is an autonomous agent that turns live TxODDS odds and scores into explainable edges, commits every decision on-chain (or paper-equivalent), and lets anyone verify that the agent saw exactly that data and made exactly that call — no fabricated P&L, no custody, no sportsbook.**

---

## The problem

Sports and prediction markets move in milliseconds. Agents that “trade” on that data usually ask you to trust a dashboard: opaque models, editable logs, and performance charts that can’t be audited. TxLINE’s mission is the opposite — **provable data and transparent systems**. An agent that can’t prove *what it saw* and *what it decided* is just another black box.

---

## What we built

Sentinel Edge sits on CryptoCheck’s multi-source signal pipeline (Telegram tokens + TxODDS match events → unified Redis stream → gate). For sports, it adds the agent stack:

| Layer | Role |
|-------|------|
| **SportsSignalEvaluator** | Explainable edge detection on `match_event` signals |
| **AgentEngine** | Autonomous decisions with opt-in, caps, and kill-switch |
| **Proof layer** | Commitment hash + HMAC; Solana Memo in live mode; `verify()` |
| **Dashboard** | Live tape, track record, controls, one-click Verify |

**Execution is not betting and not Jupiter swaps.** Execution = **signed, timestamped decision commitments**, later settled against real match outcomes for a **provable** track record.

---

## How it works (end-to-end)

```
TxODDS SSE (odds / scores)
  → TxODDSAdapter → UnifiedSignal (match_event)
  → Gate → SportsSignalEvaluator → EdgeSignal (rationale mandatory)
  → AgentEngine (if enabled & within caps)
  → Decision { side, size, dataHash, proof }
  → ProofLayer: commitmentHash + index (+ Memo if live)
  → Settlement on full_time → realized P&L from commitments only
  → Dashboard tape + Verify
```

### Edge detection (explainable by design)

Detectors on the live stream:

1. **Implied probability** — decimal odds → market view (baseline).
2. **Latency edge** — after goal / red card / penalty, gap between post-event fair value and market (or pre-move odds).
3. **Line velocity** — sharp odds moves over a short window.
4. **Model divergence** — live vs opening line.
5. **Anomaly** — statistically unusual moves — **surfaced, never acted on**.

Each hit carries a human-readable **rationale** (e.g. *odds lag 2s after the goal; fair value implies 1.80 vs market 2.20*). That rationale feeds the demo and the audit trail.

Sports rows keep verdict **`n/a`** — never conflated with crypto token risk or the swap path.

### Autonomy with guardrails

- **Opt-in:** `SIGNAL_AGENT_ENABLED=true` (and dashboard toggle).
- **Caps:** max size, per-match exposure, daily loss limit.
- **Kill-switch:** halts all new decisions immediately.
- **Modes:** `paper` (default) or `live` (Memo broadcast when configured).
- **Non-custodial:** signing uses existing `@cryptocheck/signing` HMAC primitives over commitment metadata — no user funds, no betting rails.

### The differentiator — verify

For every decision:

1. `dataHash = sha256(canonical TxODDS packet)` (evaluator output stripped).
2. Commitment = `{ agentPubkey, signalId, matchId, dataHash, side, size, edgeMagnitude, timestamp }`.
3. `commitmentHash = sha256(commitment)`; HMAC over commitment fields.
4. Off-chain index: `commitmentHash → full record` (raw packet retained).
5. Live: Solana **Memo** `SE1:<commitmentHash>`; paper: `paper:<hashPrefix>` marker.

**Verify** re-hashes the stored packet, recomputes the commitment, checks HMAC, and confirms the commitment. Tamper the packet → verify fails. That is the trust moment for judges.

Settlements commit outcome + realized P&L, linked to the original decision. **No fabricated performance** — P&L is only from committed decisions vs real results (and the same path in paper backtest).

---

## Why this fits TxLINE / the track

| Thesis | How we hit it |
|--------|----------------|
| Transparency | Every decision binds to source data via `dataHash` |
| Verifiability | One-click `verify()`; optional on-chain Memo |
| Autonomy | Agent acts without manual input when thresholds clear |
| Safety | Opt-in, caps, kill-switch, no custody, not a sportsbook |
| Crypto-native | Solana commitments; regulation-light research framing |

We are not competing with bookmakers. We are competing with **un-auditable agent dashboards**.

---

## Demo (60–90 seconds of product)

1. Open `/dashboard/signals/agent`.
2. Show opt-in controls + kill-switch.
3. On a goal/edge (live or from tape): rationale, side/size, commitment.
4. Click **Verify** → proof valid.
5. Track record: P&L / hit rate labeled **verifiable on-chain**; optional backtest strip from `npm run backtest`.

Full timing: see `docs/sentinel-edge-demo-script.md`. Judges’ Q&A: `docs/sentinel-edge-judges-faq.md`.

If live matches are quiet: `cd services/pipeline && npm run demo-seed` seeds tape + proofs from the real engine.

---

## Architecture notes (for technical judges)

- **Frozen scanner core untouched** — token risk still only via scan gateway; sports never enter Jupiter.
- **Multi-source pipeline** — Telegram (`token`) and TxODDS (`match_event`) share `ccai:sig:stream:unified` and consumer group `ccai:sig:cg:gate`.
- **Source-agnostic feed** — Master Feed filters by source/subject; swap only on Solana token rows.
- **Control plane** — Dashboard writes `ccai:sig:agent:control`; gate applies on each signal.

---

## What’s paper vs live

| | Paper | Live |
|--|-------|------|
| Decisions | Yes | Yes |
| Proof index + verify | Yes | Yes |
| Solana Memo | Marker only | Real tx when `SIGNAL_AGENT_PROOF_LIVE=true` + keypair |

Paper is enough to prove the **logic and audit trail**. Live Memo is the production upgrade path (Anchor PDA index optional later).

---

## Honest scope

Built for a short clock: Memo MVP instead of a full Anchor program; in-process match windows for edge detectors; settlement heuristics for paper P&L. The submission prioritizes the **undeniable loop** (event → edge → commitment → verify) over feature breadth.

---

## Links / paths

| Asset | Path |
|-------|------|
| Dashboard | `/dashboard/signals/agent` |
| Master Feed | `/dashboard/signals` |
| Demo script | `docs/sentinel-edge-demo-script.md` |
| Evaluator | `services/pipeline/src/gate/sports-evaluator.ts` |
| Agent | `services/pipeline/src/agent/` |
| Proof | `services/pipeline/src/agent/proof/` |
| Backtest | `services/pipeline` → `npm run backtest` |

---

## Closing line (copy-paste for forms)

> Sentinel Edge is an autonomous, capped agent on TxODDS live data that commits every decision to a tamper-evident proof — so its track record is something you can verify, not something you have to believe.
