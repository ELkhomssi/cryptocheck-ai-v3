import type { ScannerEngineInput } from '@/lib/services/scanner-engine'
import type { TransactionSimulatorResult } from '@/lib/services/scanner/types'

/**
 * Architectural simulation layer — structured placeholder for path-based buy/sell/honeypot checks.
 * Real execution wires Jupiter + simulateTransaction via `/api/v1/scan/reasoning`.
 */
export class TransactionSimulator {
  static run(input: ScannerEngineInput): TransactionSimulatorResult {
    const mintShort = input.mint ? `${input.mint.slice(0, 4)}…${input.mint.slice(-4)}` : 'unknown'

    const buyOk = true
    const sellCandidate =
      input.forceSimulationFailure === true || input.simulateSwapPassed === false ? false : true

    let honeypot: TransactionSimulatorResult['honeypotLikelihood'] = 'low'
    if (!sellCandidate) honeypot = 'high'
    else if ((input.signals?.extreme_tax_or_blacklist ?? false) || (input.creatorScamLinkedFundingCount ?? 0) > 2) {
      honeypot = 'medium'
    }

    return {
      buy: {
        ok: buyOk,
        path: 'simulated_jupiter_v1→pool',
        summary: `Buy path dry-run for ${mintShort} — route composed; no signature broadcast.`,
      },
      sell: {
        ok: sellCandidate,
        path: 'pool→simulated_jupiter_v1',
        summary: sellCandidate
          ? `Sell path resolves under placeholder rules — verify with serialized swap + RPC.`
          : `Sell path flagged — aligns with honeypot / blacklist simulation failure.`,
      },
      honeypotLikelihood: honeypot,
      notes:
        'Structured simulation only. For institutional-grade enforcement, pass serializedSwapTransactionBase64 to the scan API for on-chain simulateTransaction.',
    }
  }
}
