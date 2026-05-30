# B2B smoke test results

**Updated:** 2026-05-28 (B2B surface implemented)

## Routes

| Route | Method | Status |
|-------|--------|--------|
| `app/api/b2b/v1/risk/route.ts` | POST | ✅ Implemented |
| `app/api/b2b/v1/reputation/route.ts` | GET | ✅ Implemented |

## Auth

- `Authorization: Bearer <partner_key>` (required)
- Test partner: `B2B_TEST_API_KEY` (+ `X-CCAI-Partner-Secret: <B2B_TEST_SECRET>`)
- Real partners: `cc_partner_*` keys with `X-CryptoCheck-Signature` (HMAC via `@cryptocheck/signing`)
- Implemented in `lib/b2b/partner-auth.ts`

## Tests (audit Task 4)

| # | Request | Expected | Local result |
|---|---------|----------|--------------|
| 1 | `POST /api/b2b/v1/risk` — USDC, `mode: fast` | `score` &lt; 30 | ⏭️ blocked — `HELIUS_API_KEY` unset (route + auth verified, 5xx at RPC enrichment) |
| 2 | `POST /api/b2b/v1/risk` — rug mint | `score` &gt; 70 | ⏭️ blocked — needs `HELIUS_API_KEY` **and** a real high-risk `B2B_TEST_RUG_MINT` |
| 3 | `GET /api/b2b/v1/reputation?chain=solana&address=…` | HTTP 200 | ⏭️ blocked — same RPC dependency |
| 4 | Webhook delivery when `webhookUrl` set | `risk.assessed` POST | Implemented in `lib/b2b/webhook-delivery.ts` (HMAC-signed) |

## Score convention

B2B `score` is a **risk** score (`100 − safety`): higher = riskier. USDC (curated-safe) → low; rug → high.

## Reputation ledger

- Redis `ccai:rep:v1:<chain>:<address>` (TTL 300s) via `lib/b2b/reputation-ledger.ts`
- On cache miss, `GET /reputation` computes a fast scan and writes the snapshot.

## To make Task 4 PASS

1. Set `HELIUS_API_KEY` in `.env.local` (enrichment RPC).
2. Set `B2B_TEST_RUG_MINT` to a genuinely high-risk mint — the default wSOL is legitimately SAFE.
3. Run a dev server, then:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000 npm run audit:post-migration
```

The audit reports **skip** (not fail) when the server is unreachable or a scan dependency returns 5xx, so a missing local secret never produces a false-negative gate failure.
