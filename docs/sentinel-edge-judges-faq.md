# Sentinel Edge — judges’ FAQ

Short answers for Q&A after the demo.

---

### Is this sports betting?

**No.** The agent does not place bets, hold funds, or connect to a sportsbook. “Execution” means a **signed decision commitment** (paper index or Solana Memo), settled against real match outcomes for a **research / audit track record**. Compliance line on the dashboard states this explicitly.

---

### How is this different from a normal trading bot dashboard?

Most bots show P&L you have to trust. We bind every decision to the **exact TxODDS packet** (`dataHash`), commit a hash of the decision fields, and expose **Verify** — re-hash the packet, rebuild the commitment, check HMAC. If the log was edited, verify fails.

---

### What does Verify actually check?

1. **dataHash** — stored raw packet still hashes to what was committed  
2. **commitmentHash** — commitment fields weren’t altered  
3. **HMAC** — signed with the agent signing key (`@cryptocheck/signing`)  
4. **Paper / on-chain** — paper marker trusts the index; live mode also records Memo `SE1:<commitmentHash>`

---

### Why paper mode in the demo?

Paper proves the **full logic and audit trail** without needing a funded keypair on stage. Live mode is the same commitment, broadcast via Solana Memo when `SIGNAL_AGENT_PROOF_LIVE=true`. Upgrade path: Anchor PDAs for queryable on-chain history.

---

### Can the agent lose money for users?

**No user funds are involved.** Caps and daily loss limits apply to **paper (or commitment) position units**, not custodial balances. Kill-switch stops new decisions immediately.

---

### What if there’s no live World Cup match during judging?

Run `npm run demo-seed` in `services/pipeline` (needs Upstash). It replays sample match timelines through the real evaluator + agent, fills the live tape, indexes proofs (Verify works), and publishes the backtest strip. Narrate: *same engine as live; packet binding is identical.*

---

### Does this touch your token scanner / swap engine?

**No.** Frozen scanner core is untouched. Token signals still use the scan gateway. Sports `match_event` rows never enter Jupiter. Master Feed shows both; only Solana tokens get Safe Swap.

---

### Where does TxODDS fit?

TxODDS is the **authorized live odds/scores source** (hackathon access). We normalize to `UnifiedSignal`, keep `rawPayload` for the audit trail, and respect API terms (credentials from env, reconnect/backoff).

---

### Is performance fabricated?

**No.** Track record P&L is only from **committed decisions** settled on full-time outcomes (live tape or demo-seed/backtest). No synthetic win-rate charts.

---

### What’s the one-sentence thesis?

> An autonomous agent is only as trustworthy as its audit trail — we made the audit trail the product.
