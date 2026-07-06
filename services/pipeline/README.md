# Signal Pipeline (Prompts 1–3)

Parser, legacy enrich, and **unified gate** workers consuming Redis Streams.

## Stages

| Worker | Consumes | Produces |
|--------|----------|----------|
| `parser` (legacy) | `ccai:sig:stream:raw` | `ccai:sig:stream:parsed` |
| `enrich` (legacy) | `ccai:sig:stream:parsed` | Postgres + feed |
| **`gate` (Prompt 3)** | `ccai:sig:stream:unified` | Postgres + feed |

Multi-source adapters (`services/ingestion`) write `UnifiedSignal` to `ccai:sig:stream:unified`. The gate is the primary path.

## Unified gate (Prompt 3) ✅

Consumer group: `ccai:sig:cg:gate`

| subjectType | Evaluator | Swap path |
|-------------|-----------|-----------|
| `token` | `POST /api/internal/signals/assess` (scan gateway) | Yes — risk-gated Jupiter (UI only) |
| `match_event` | `SportsSignalEvaluator` (explainable `EdgeSignal`) | **No** — verdict `n/a`, info only |

Flow:

1. XREADGROUP from `ccai:sig:stream:unified`
2. **Async-upgrade:** persist + pub `verdict: scanning` → evaluate → pub `signal.update`
3. Persist `signal_normalized` (multi-source columns)
4. Publish `UnifiedFeedEvent` on `ccai:sig:stream:feed` + feed cache

### SportsSignalEvaluator (Sentinel Edge Prompt A)

Explainable edge on `match_event` only — `verdict` stays `n/a`; `scoreValue` = `EdgeSignal.magnitude`.

| Detector | Role |
|----------|------|
| `implied_probability` | Decimal odds → implied prob (baseline market view) |
| `latency_edge` | Post goal / red card / penalty lag vs fair value |
| `line_velocity` | Sharp odds moves over a short window |
| `model_divergence` | Live vs opening line |
| `anomaly` | Unusual z-score moves — **surface only, never act** |

`EdgeSignal` attaches to `UnifiedSignal.edgeSignal` (+ `rawPayload.edgeSignal` for audit). Fixture check:

```bash
npx tsx src/gate/sports/__tests__/sports-evaluator.fixture.ts
```

### AgentEngine (Sentinel Edge Prompt B)

Autonomous, capped decisions on enriched `match_event` only. **Not** Jupiter / fiat betting.

| Control | Env |
|---------|-----|
| Opt-in | `SIGNAL_AGENT_ENABLED=true` |
| Kill-switch | `SIGNAL_AGENT_KILL_SWITCH=true` |
| Mode | `SIGNAL_AGENT_MODE=paper\|live` |
| Thresholds | `SIGNAL_AGENT_EDGE_THRESHOLD`, `SIGNAL_AGENT_CONFIDENCE_FLOOR` |
| Caps | `MAX_SIZE`, `PER_MATCH_CAP`, `DAILY_LOSS_LIMIT` |

Emits `agent.decision` / `agent.settlement` / `agent.stand_down` on `ccai:sig:stream:agent`. Decisions are HMAC-signed via `@cryptocheck/signing` and bind `dataHash` of the raw TxODDS packet.

```bash
npx tsx src/agent/__tests__/agent-engine.fixture.ts
```

### Proof layer (Sentinel Edge Prompt C)

Every decision/settlement builds a commitment, HMAC-signs it (`@cryptocheck/signing`), and indexes `commitmentHash → full record` (raw packet retained for audit).

| Mode | On-chain |
|------|----------|
| `paper` (default) | `paper:<hashPrefix>` marker — verify uses off-chain index |
| `live` + `SIGNAL_AGENT_PROOF_LIVE=true` | Solana **Memo** program (`SE1:<commitmentHash>`) |

`verify(commitmentHash)` re-hashes the stored TxODDS packet, recomputes commitment, checks HMAC, and (when live) reads the Memo from the tx.

```bash
npx tsx src/agent/proof/__tests__/proof.fixture.ts
npm run backtest    # paper replay → verifiable track record
npm run demo-seed   # seed dashboard tape + proofs + backtest (needs Upstash)
```

```bash
# Terminal 1 — Next.js app (gateway assess)
npm run dev

# Terminal 2 — gate worker
cd services/pipeline && npm run dev:gate
curl http://localhost:4105/health
```

## Legacy enrich (still available)

```bash
cd services/pipeline && npm run dev:enrich
curl http://localhost:4104/health
```

Legacy enrich maps `NormalizedSignal` → `UnifiedSignal` before feed publish so Master Feed stays source-agnostic.

## Parser (legacy)

```bash
cd services/pipeline && npm run dev:parser
curl http://localhost:4103/health
```
