/**
 * Dev-only fallback salt — must match server `SCAN_API_DOCS_DEV_SIGNING_SALT` in local environments.
 * Production integrators must use the salt issued with their partner credentials.
 */
export const DEV_SIGNING_SALT_FALLBACK = 'cryptocheck_dev_api_signing_salt_v1'

export const SIGNATURE_HEADER = 'X-CryptoCheck-Signature'
export const TIMESTAMP_HEADER = 'X-CryptoCheck-Timestamp'
