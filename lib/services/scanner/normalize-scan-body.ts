import { ScanServiceError } from '@/lib/services/scanner/ErrorHandler'

const SUPPORTED_CHAINS = new Set(['solana', 'sol'])

/**
 * Normalizes developer API bodies (`tokenAddress`, `chain`) into the internal pipeline shape (`mint`, …).
 */
export function normalizeScanBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body }

  const token =
    typeof body.tokenAddress === 'string'
      ? body.tokenAddress.trim()
      : typeof body.mint === 'string'
        ? body.mint.trim()
        : ''

  if (token) {
    out.mint = token
  }

  if (body.chain != null) {
    const c = String(body.chain).toLowerCase().trim()
    if (!SUPPORTED_CHAINS.has(c)) {
      throw new ScanServiceError(
        `Unsupported chain "${body.chain}". Supported: solana`,
        'INVALID_INPUT',
        400
      )
    }
  }

  return out
}
