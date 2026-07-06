# Sentinel Edge — 3-minute demo script

**Goal:** One undeniable loop — *a real match event → a real edge → a real, verifiable commitment — in under a minute on screen.*

**Surfaces:** `/dashboard/signals/agent` (Sentinel Edge) · optional Master Feed for context.

**Pre-flight (before you record / present):**

1. Next.js app running; Upstash Redis configured.
2. `services/pipeline` gate with:
   ```bash
   SIGNAL_AGENT_ENABLED=true
   SIGNAL_AGENT_MODE=paper
   SIGNAL_AGENT_KILL_SWITCH=false
   SIGNAL_AGENT_SIGNING_KEY=<same as app if you demo Verify HMAC>
   ```
3. **Demo seed (recommended if no live match):**
   ```bash
   cd services/pipeline && npm run demo-seed
   ```
   Fills agent tape + proof index + backtest strip. Use the **same** `SIGNAL_AGENT_SIGNING_KEY` on the Next.js app for Verify HMAC.
4. Optional live path: TxODDS ingestion (`SIGNAL_SOURCES=…,txodds`) so a real goal can fire.
5. Open `/dashboard/signals/agent`. Kill-switch **off**, agent **On**, mode **Paper**.

---

## 60-second cut (if time is brutal)

| Time | Action | Line |
|------|--------|------|
| 0–10s | Dashboard + compliance | “Autonomous agent on TxODDS — not betting; every decision is a verifiable commitment.” |
| 10–25s | Kill-switch + caps | “Opt-in, capped, kill-switchable.” |
| 25–40s | Point at decision rationale | “Edge after the goal — fair value vs market, in plain language.” |
| 40–55s | Click **Verify** | “Re-hash the packet — proves what it saw and what it committed.” |
| 55–60s | Track record | “P&L only from commitments. Trust the button, not the chart.” |

---

## 0:00–0:20 — Hook (transparency, not betting)

**Say:**

> “This is Sentinel Edge — an autonomous agent on live sports data. It doesn’t place bets and it doesn’t custody funds. Every decision is a **signed, timestamped commitment** tied to the exact TxODDS packet it saw. The track record is tamper-evident and backtestable. That’s the TxLINE transparency mission.”

**Show:** Header + compliance line (*informational / on-chain research agent — not betting*).

---

## 0:20–0:45 — Controls (autonomous but safe)

**Say:**

> “Autonomous mode is **opt-in**, **capped**, and **kill-switchable**. Thresholds and per-match / daily loss limits are enforced in the engine — if a cap is hit, it stands down and logs why.”

**Do:**

1. Point at **Enabled**, **Paper**, edge threshold, caps.
2. Hover/click **Kill-switch** (don’t leave it on unless you want to show stand-down).
3. Leave kill-switch **off** for the live decision.

**Say:**

> “Paper mode commits proofs to an off-chain index with a paper marker. Live mode writes the same commitment hash to Solana Memo — same verify path either way.”

---

## 0:45–1:30 — The moment (event → edge → decision)

**Ideal:** A live goal / red card lands on the tape.

**If live data is quiet:** Point at an existing decision row from backtest/tape, or run `npm run backtest` beforehand and refresh so decisions exist.

**Say (as a row appears or while highlighting one):**

> “Here’s a match event. The SportsSignalEvaluator didn’t just score it — it produced an **explainable edge**: implied probability, latency after the goal, line velocity, model divergence. Anomaly is surfaced but never acted on.”

**Point at:** Rationale text on the row (e.g. *odds lag after the goal; fair value implies X vs market Y*).

**Say:**

> “When magnitude and confidence clear the thresholds and we’re inside caps, the agent **decides without a human click** — side, size, and a `dataHash` of the exact source packet.”

**Point at:** Side · size · edge magnitude · commitment hash prefix.

---

## 1:30–2:15 — The trust moment (Verify)

**Do:** Click **Verify** on that decision.

**Say:**

> “Verify re-hashes the stored TxODDS packet, rebuilds the commitment, checks the HMAC, and confirms it matches what we committed. If anyone edited the packet after the fact, this fails.”

**Show:** Green “Proof valid” with check details (`dataHashMatch`, `commitmentHashMatch`, `hmacValid`).

**If paper:**

> “This one’s a paper commitment — index is source of truth. Same button works for a live Memo transaction with an Explorer link.”

**If live tx exists:** Click **Explorer** / proof link.

---

## 2:15–2:40 — Track record (no fabricated P&L)

**Point at:** Track record panel.

**Say:**

> “P&L, hit rate, decision count — all labeled **verifiable on-chain**. Every number comes from committed decisions settled against real match outcomes. No fabricated performance.”

**If backtest strip is present:**

> “The backtest strip is the same engine in paper mode over historical timelines — every row was committed and verified, not a spreadsheet.”

---

## 2:40–3:00 — Close (why this wins)

**Say:**

> “Crypto-native, regulation-light, and aligned with TxLINE: the agent’s brain is the edge engine; the product is the **audit trail**. One goal, one edge, one proof — you can check it yourself.”

**Optional kill-switch beat (5s):** Flip kill-switch on — “And we can halt all new decisions instantly.”

**Stop on:** Dashboard with a verified decision visible.

---

## Backup paths (if something fails)

| Failure | Recovery |
|--------|----------|
| Empty tape | `cd services/pipeline && npm run demo-seed` (tape + proofs + backtest). Refresh `/dashboard/signals/agent`. |
| Verify fails HMAC | Set `SIGNAL_AGENT_SIGNING_KEY` the **same** on gate and Next.js app. |
| Verify “proof not found” | Gate must use Redis (`UPSTASH_*`); proofs are indexed under `ccai:sig:proof:`. |
| No live goals | Narrate from an existing tape row + backtest; emphasize verify still proves the packet binding. |

---

## One-line judges’ takeaway

> **We don’t ask you to trust our P&L — we give you a button that proves what the agent saw and what it committed.**
