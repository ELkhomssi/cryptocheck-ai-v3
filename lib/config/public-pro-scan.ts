/**
 * Synthetic actor for unauthenticated `/pro/dashboard` live scans.
 * `security_logs.user_id` is set to null when logging events for this id (see `securityLogUserIdForContext`).
 */
export const ANONYMOUS_PUBLIC_PRO_SCAN_USER_ID = '00000000-0000-0000-0000-0000000000ff'
