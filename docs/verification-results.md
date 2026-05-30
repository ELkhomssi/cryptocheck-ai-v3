# Phase verification results

**Generated:** 2026-05-30T12:55:24.498Z
**Target:** http://localhost:3100
**Gate:** ✅ PASS

| Result | Count |
|--------|-------|
| ✅ pass | 8 |
| ⚠️ warn | 2 |
| ❌ fail | 0 |
| ⏭️ skip | 3 |

## Checks

| ID | Check | Status | Detail |
|----|-------|--------|--------|
| T1-ui | Trading UI wiring (Intel → Trade tab → RiskGatedSwapPanel) | pass | IntelligenceTradeTabs renders RiskGatedSwapPanel; BLOCKED verdict disables swap button |
| T1-api | POST /api/trading/assess-swap | skip | Set TEST_API_KEY for authenticated assess-swap probe |
| P6-assess | Risk assess latency (B2B fast scan proxy) | warn | score=5 — exceeds 200ms target (31163ms) |
| P1-merchant | POST /api/payments/merchant | pass | Merchant registered (1910ms) |
| P1-intent | POST /api/payments/intent (risk check) | warn | id=pi_bcbc256e-06d8-4830-ae64-cf0f1893cd86 status=risk_approved approved=true — exceeds 300ms target (2025ms) |
| P1-page | GET /pay/[wallet]?embed=true | pass | Hosted embed checkout page renders (5177ms) |
| P3-portfolio | GET /api/portfolio/[wallet] | skip | Set TEST_API_KEY for portfolio probe |
| P4-bundle | ccai-pay.min.js structure | pass | 6.8 KB — CCAIPay + createButton + openPaymentModal present |
| P4-demo | GET /ccai-pay-demo.html | pass | Demo page served — open in browser to test modal |
| P4-cdn | GET /ccai-pay/v1/ccai-pay.min.js | pass | Bundle served locally (CDN path preview) (18ms) |
| T2-signals | GET /api/trading/signals (SSE) | skip | Set TEST_API_KEY for SSE probe |
| audit-T4 | B2B smoke (POST /api/b2b/v1/risk) | pass | score=5 confidence=85 (512ms) |
| audit-gate | Architecture audit scoreboard | pass | gate=pass T1=warn T3=pass T4=skip T5=pass |

## Manual follow-ups

- **Trading UI:** Open `/dashboard/intelligence-terminal`, select a token, click **Trade** tab — confirm risk panel loads.
- **CCAI Pay modal:** Open `http://localhost:3100/ccai-pay-demo.html`, click the button — modal + wallet prompt should appear.
- **Wallet signing:** Full on-chain payment/swap requires a connected browser wallet (not covered by this script).

