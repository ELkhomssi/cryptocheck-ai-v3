/**
 * MEV risk score from real conditions — not cosmetic.
 * Reflects order size vs liquidity + congestion; pairs with private submission path.
 */

import type { MevProtectionView } from '../types'

export function computeMevProtection(input: {
  amountUsd: number
  liquidityUsd: number
  /** Recent slot lag ms (Solana) or block lag ms (EVM) when known */
  slotLagMs?: number
  /** Solana: Jito private path available */
  jitoEnabled: boolean
  /** EVM: Flashbots Protect–style private RPC configured */
  privateRpcEnabled?: boolean
  chain?: 'solana' | 'evm'
}): MevProtectionView {
  const chain = input.chain ?? 'solana'
  const liq = Math.max(1, input.liquidityUsd)
  const sizeRatio = input.amountUsd / liq
  let congestion: MevProtectionView['congestion'] = 'medium'
  const lag = input.slotLagMs
  if (lag != null) {
    if (lag >= 2500) congestion = 'extreme'
    else if (lag >= 1200) congestion = 'high'
    else if (lag >= 600) congestion = 'medium'
    else congestion = 'low'
  }

  let risk = Math.min(95, Math.round(sizeRatio * 400))
  if (congestion === 'high') risk = Math.min(100, risk + 12)
  if (congestion === 'extreme') risk = Math.min(100, risk + 22)
  if (congestion === 'low') risk = Math.max(5, risk - 8)

  const tipBase = congestion === 'extreme' ? 200_000 : congestion === 'high' ? 100_000 : 50_000

  if (chain === 'evm') {
    const tipLamports = 0
    let route: MevProtectionView['route'] = 'public_rpc'
    if (input.privateRpcEnabled) route = 'flashbots_protect'
    else if (congestion !== 'low') route = 'priority_fee'

    const explanation =
      route === 'flashbots_protect'
        ? `Private / protected RPC path (Flashbots Protect–style). Order is ${(sizeRatio * 100).toFixed(2)}% of pool liquidity.`
        : route === 'priority_fee'
          ? `Priority-fee path — private RPC unavailable. Size is ${(sizeRatio * 100).toFixed(2)}% of pool.`
          : `Public mempool path. Keep size small vs liquidity (${(sizeRatio * 100).toFixed(2)}% of pool).`

    return { riskScore: risk, route, tipLamports, congestion, explanation }
  }

  const tipLamports = input.jitoEnabled ? tipBase : 0
  let route: MevProtectionView['route'] = 'public_rpc'
  if (input.jitoEnabled && tipLamports > 0) route = 'jito_private'
  else if (tipLamports > 0 || congestion !== 'low') route = 'priority_fee'

  const explanation =
    route === 'jito_private'
      ? `Private Jito submission planned (tip ${tipLamports} lamports). Order is ${(sizeRatio * 100).toFixed(2)}% of pool liquidity.`
      : route === 'priority_fee'
        ? `Priority-fee path — Jito private route unavailable. Size is ${(sizeRatio * 100).toFixed(2)}% of pool.`
        : `Public RPC path. Keep size small vs liquidity (${(sizeRatio * 100).toFixed(2)}% of pool).`

  return { riskScore: risk, route, tipLamports, congestion, explanation }
}
