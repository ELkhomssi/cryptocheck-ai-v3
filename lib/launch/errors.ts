import { randomUUID } from 'crypto'

export type LaunchErrorCode =
  | 'WALLET_DISCONNECTED'
  | 'INSUFFICIENT_SOL'
  | 'SIMULATION_FAILED'
  | 'BLOCKHASH_EXPIRED'
  | 'METADATA_UPLOAD_FAILED'
  | 'TX_REJECTED'
  | 'USER_REJECTED'
  | 'RATE_LIMITED'
  | 'DUPLICATE'
  | 'NETWORK_CONGESTION'
  | 'RPC_TIMEOUT'
  | 'LAUNCH_BLOCKED'
  | 'LAUNCH_PAUSED'
  | 'CONFIG_INVALID'
  | 'UNKNOWN'

export type LaunchErrorBody = {
  error: string
  code: LaunchErrorCode
  detail?: string
  trackingId: string
  compliance?: string
}

export function newTrackingId(): string {
  return `launch_${randomUUID().replace(/-/g, '').slice(0, 16)}`
}

const FRIENDLY: Record<LaunchErrorCode, string> = {
  WALLET_DISCONNECTED: 'Connect a Solana wallet to continue.',
  INSUFFICIENT_SOL: 'Not enough SOL to cover rent and network fees.',
  SIMULATION_FAILED: 'Transaction simulation failed — review your parameters and try again.',
  BLOCKHASH_EXPIRED: 'Transaction expired. Please prepare again.',
  METADATA_UPLOAD_FAILED: 'Metadata upload failed. Retry in a moment.',
  TX_REJECTED: 'The network rejected this transaction.',
  USER_REJECTED: 'You cancelled the wallet signature.',
  RATE_LIMITED: 'Too many attempts. Please wait and try again.',
  DUPLICATE: 'This launch was already recorded.',
  NETWORK_CONGESTION: 'Network is congested. Retry shortly.',
  RPC_TIMEOUT: 'RPC timed out. Retry shortly.',
  LAUNCH_BLOCKED: 'Launch blocked by scanner gates.',
  LAUNCH_PAUSED: 'Token create is temporarily paused.',
  CONFIG_INVALID: 'LaunchLab configuration is invalid.',
  UNKNOWN: 'Something went wrong while launching.',
}

export function classifyLaunchError(err: unknown): LaunchErrorCode {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  if (/user rejected|rejected the request|cancelled|canceled/.test(msg)) return 'USER_REJECTED'
  if (/blockhash|expired/.test(msg)) return 'BLOCKHASH_EXPIRED'
  if (/insufficient|0x1\b|insufficient funds|not enough sol/.test(msg)) return 'INSUFFICIENT_SOL'
  if (/simulation|preflight/.test(msg)) return 'SIMULATION_FAILED'
  if (/timeout|timed out|etimedout/.test(msg)) return 'RPC_TIMEOUT'
  if (/429|too many|rate limit/.test(msg)) return 'RATE_LIMITED'
  if (/congest|priority fee|block height exceeded/.test(msg)) return 'NETWORK_CONGESTION'
  if (/duplicate|already exists|23505/.test(msg)) return 'DUPLICATE'
  if (/metadata|pinata|ipfs/.test(msg)) return 'METADATA_UPLOAD_FAILED'
  if (/wallet|disconnected|publickey/.test(msg)) return 'WALLET_DISCONNECTED'
  return 'UNKNOWN'
}

export function launchErrorResponse(
  code: LaunchErrorCode,
  opts?: { detail?: string; trackingId?: string; compliance?: string; status?: number },
): { body: LaunchErrorBody; status: number } {
  const trackingId = opts?.trackingId ?? newTrackingId()
  const status =
    opts?.status ??
    (code === 'RATE_LIMITED'
      ? 429
      : code === 'LAUNCH_BLOCKED'
        ? 403
        : code === 'LAUNCH_PAUSED' || code === 'CONFIG_INVALID'
          ? 503
          : 502)
  console.error(`[launch-error] trackingId=${trackingId} code=${code} detail=${opts?.detail ?? ''}`)
  return {
    status,
    body: {
      error: FRIENDLY[code],
      code,
      detail: opts?.detail,
      trackingId,
      compliance: opts?.compliance,
    },
  }
}
