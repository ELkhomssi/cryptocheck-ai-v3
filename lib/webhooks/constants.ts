/** Gaps after failed HTTP attempts 2, 3 (attempt 4 has no following retry). */
export const WEBHOOK_RETRY_GAP_MS = [30_000, 120_000, 600_000] as const

export const WEBHOOK_MAX_ATTEMPTS = 4

export const WEBHOOK_DISABLE_AFTER_FAILURES = 10
