# Phase verification results

**Generated:** 2026-05-30T16:53:09.744Z
**Target:** https://www.cryptocheckai.com
**Gate:** ❌ FAIL

| Result | Count |
|--------|-------|
| ✅ pass | 7 |
| ⚠️ warn | 1 |
| ❌ fail | 2 |
| ⏭️ skip | 3 |

## Checks

| ID | Check | Status | Detail |
|----|-------|--------|--------|
| T1-ui | Trading UI wiring (Intel → Trade tab → RiskGatedSwapPanel) | pass | IntelligenceTradeTabs renders RiskGatedSwapPanel; BLOCKED verdict disables swap button |
| T1-api | POST /api/trading/assess-swap | skip | Set TEST_API_KEY for authenticated assess-swap probe |
| P6-assess | Risk assess latency (B2B fast scan proxy) | fail | HTTP 401: Partner key requires a valid X-CryptoCheck-Signature. (559ms) |
| P1-merchant | POST /api/payments/merchant | pass | Merchant registered (415ms) |
| P1-intent | POST /api/payments/intent (risk check) | warn | id=pi_9d73c301-a2d6-4497-a5bb-71ea7331e64e status=risk_approved approved=true — exceeds 300ms target (9645ms) |
| P1-page | GET /pay/[wallet]?embed=true | pass | Hosted embed checkout page renders (541ms) |
| P3-portfolio | GET /api/portfolio/[wallet] | skip | Set TEST_API_KEY for portfolio probe |
| P4-bundle | ccai-pay.min.js structure | pass | 6.8 KB — CCAIPay + createButton + openPaymentModal present |
| P4-demo | GET /ccai-pay-demo.html | pass | Demo page served — open in browser to test modal |
| P4-cdn | GET /ccai-pay/v1/ccai-pay.min.js | pass | Bundle served locally (CDN path preview) (87ms) |
| T2-signals | GET /api/trading/signals (SSE) | skip | Set TEST_API_KEY for SSE probe |
| audit-T4 | B2B smoke (POST /api/b2b/v1/risk) | fail | HTTP 401: Partner key requires a valid X-CryptoCheck-Signature. (161ms) |
| audit-gate | Architecture audit scoreboard | pass | gate=pass T1=fail T3=pass T4=skip T5=pass |

## Manual follow-ups

- **Trading UI:** Open `/dashboard/intelligence-terminal`, select a token, click **Trade** tab — confirm risk panel loads.
- **CCAI Pay modal:** Open `https://www.cryptocheckai.com/ccai-pay-demo.html`, click the button — modal + wallet prompt should appear.
- **Wallet signing:** Full on-chain payment/swap requires a connected browser wallet (not covered by this script).

