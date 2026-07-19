/**
 * Personal-watch verification checklist (manual + automated).
 *
 * Automated:
 *   node --import tsx --test __tests__/personal-watch/*.test.ts
 *
 * Cost model evidence (unique mint, not user×mint):
 *   curl -X POST $APP/api/internal/watch/verify-dedupe \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"userCount":10}'
 *   Expect: uniqueMints === 1
 *
 * Cron tick evidence:
 *   curl -H "Authorization: Bearer $CRON_SECRET" $APP/api/cron/personal-watch
 *   Expect JSON: scansExecuted <= uniqueMints (capped), evidence.costModel string
 *
 * Degrade → push (manual, real mechanism):
 *   1. Add mint A + B to watchlist for user U (premium + push subscribed)
 *   2. Ensure token_watch_snapshots has SAFE for mint A
 *   3. Wait for cron OR call personal-watch after the underlying token genuinely worsens
 *      (do not stub gateway — re-run after real on-chain / gateway state change)
 *   4. Confirm watch_degrade_events row for U only; push payload url includes mint=
 *
 * Saved-You path:
 *   DANGER watch degrade → user_blocks source='watch' → /api/cron/saved-you-grade
 *   → saved_you only on compound rug evidence (existing engine)
 *
 * Coach empty state:
 *   New user with <5 FeeRecords → insightEmptyReason set, no invented pattern
 */
export {}
