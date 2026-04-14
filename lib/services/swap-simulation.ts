import type { Connection } from '@solana/web3.js'
import { VersionedTransaction } from '@solana/web3.js'

export type SwapSimulationRpcResult = {
  /** Simulation completed (RPC reachable). */
  ran: boolean
  /** True when simulateTransaction reports an error (e.g. sell would revert — honeypot pattern). */
  sellSimulationFailed: boolean
  rpcError?: string
  logs: string[]
  unitsConsumed?: number
}

/**
 * Runs `simulateTransaction` on a serialized swap (e.g. Jupiter) to catch hidden honeypots
 * before any signature. Wire Jupiter quote → transaction → base64 here from the client later.
 */
export async function simulateSerializedSwapTransaction(
  connection: Connection,
  serializedBase64: string
): Promise<SwapSimulationRpcResult> {
  try {
    const raw = Buffer.from(serializedBase64, 'base64')
    const vtx = VersionedTransaction.deserialize(new Uint8Array(raw))
    const { value } = await connection.simulateTransaction(vtx, {
      replaceRecentBlockhash: true,
      sigVerify: false,
      commitment: 'processed',
    })
    const failed = value.err != null
    return {
      ran: true,
      sellSimulationFailed: failed,
      rpcError: failed ? JSON.stringify(value.err) : undefined,
      logs: value.logs ?? [],
      unitsConsumed: value.unitsConsumed ?? undefined,
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ran: true,
      sellSimulationFailed: true,
      rpcError: msg,
      logs: [],
    }
  }
}

/**
 * Heuristic “tax / slippage drag” from quote deltas (expected vs simulated or actual out).
 * Prefer Jupiter quote fields when available; on-chain tax % is token-specific.
 */
export function computeRealizedTaxFromQuotes(
  expectedOut?: number | null,
  actualOut?: number | null
): number | null {
  if (expectedOut == null || actualOut == null) return null
  if (expectedOut <= 0) return null
  const pct = ((expectedOut - actualOut) / expectedOut) * 100
  if (!Number.isFinite(pct)) return null
  return Math.max(0, Math.min(100, pct))
}
