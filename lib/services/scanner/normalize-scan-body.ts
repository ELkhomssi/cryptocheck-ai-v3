import { ScanServiceError } from '@/lib/services/scanner/ErrorHandler'

const SUPPORTED_CHAINS = new Set(['solana', 'sol'])

function isValidSolanaMintAddress(s: string): boolean {
  if (s.length < 32 || s.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

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
    if (!isValidSolanaMintAddress(token)) {
      throw new ScanServiceError(
        'The provided Solana address is malformed.',
        'INVALID_MINT_ADDRESS',
        400,
        undefined,
        'INVALID_MINT_ADDRESS',
        'high'
      )
    }
    out.mint = token
  }

  if (body.chain != null) {
    const c = String(body.chain).toLowerCase().trim()
    if (!SUPPORTED_CHAINS.has(c)) {
      throw new ScanServiceError(
        `Unsupported chain "${body.chain}". Supported: solana`,
        'INVALID_INPUT',
        400,
        undefined,
        'UNSUPPORTED_CHAIN',
        'medium'
      )
    }
  }

  return out
}
