import BN from 'bn.js'
import {
  MIN_SELL_FRACTION,
  MIN_SOL_TARGET,
  MIN_SOL_TARGET_DEVNET,
  MIN_SUPPLY_HUMAN,
  LAUNCH_DECIMALS,
} from './constants'
import { humanToBaseUnits, justSendItParams, launchCluster } from './config'
import type { LaunchCurvePreset } from './types'

function minSolTarget(): number {
  return launchCluster() === 'devnet' ? MIN_SOL_TARGET_DEVNET : MIN_SOL_TARGET
}

export type ResolvedCurveParams = {
  supply: BN
  totalSellA: BN
  totalFundRaisingB: BN
  decimals: number
  totalLockedAmount: BN
  cliffPeriod: BN
  unlockPeriod: BN
}

/**
 * Validate + resolve curve params. Rejects rug-shaped configs before any tx is built.
 */
export function resolveCurveParams(input: {
  curveType?: LaunchCurvePreset
  supply: number
  solTarget: number
  totalLockedAmount?: number
  cliffPeriodSec?: number
  unlockPeriodSec?: number
}): { ok: true; params: ResolvedCurveParams } | { ok: false; reasons: string[] } {
  const reasons: string[] = []
  const preset = input.curveType ?? 'justsendit'
  const solTarget = Number(input.solTarget)
  const supplyHuman = Number(input.supply)

  const minSol = minSolTarget()
  if (!Number.isFinite(solTarget) || solTarget < minSol) {
    reasons.push(
      `SOL target must be ≥ ${minSol} SOL` +
        (launchCluster() === 'devnet' ? ' (devnet happy-path floor)' : ' (rejects low-cap rug shapes)'),
    )
  }
  if (!Number.isFinite(supplyHuman) || supplyHuman < MIN_SUPPLY_HUMAN) {
    reasons.push(`Supply must be ≥ ${MIN_SUPPLY_HUMAN.toLocaleString()} tokens`)
  }
  if (supplyHuman > 1_000_000_000_000) {
    reasons.push('Supply exceeds maximum (1T tokens)')
  }

  const lockedHuman = Number(input.totalLockedAmount ?? 0)
  if (lockedHuman < 0 || lockedHuman > supplyHuman * 0.5) {
    reasons.push('Vesting lock must be 0–50% of supply')
  }

  if (reasons.length) return { ok: false, reasons }

  let supply: BN
  let totalSellA: BN
  let totalFundRaisingB: BN
  let decimals = LAUNCH_DECIMALS

  if (preset === 'justsendit') {
    const j = justSendItParams(solTarget)
    supply = j.supply
    totalSellA = j.totalSellA
    totalFundRaisingB = j.totalFundRaisingB
    decimals = j.decimals
  } else {
    supply = humanToBaseUnits(supplyHuman, LAUNCH_DECIMALS)
    // Match JustSendIt sell fraction (~79.31%) — 50% sells leave remaining==sell and break curve init (÷0).
    totalSellA = supply.mul(new BN(793_100_000_000_000)).div(new BN(1_000_000_000_000_000))
    totalFundRaisingB = new BN(Math.floor(solTarget * 1e9))
  }

  const sellFrac = totalSellA.muln(10_000).div(supply).toNumber() / 10_000
  if (sellFrac < MIN_SELL_FRACTION) {
    reasons.push(`totalSellA must be ≥ ${MIN_SELL_FRACTION * 100}% of supply (got ${(sellFrac * 100).toFixed(1)}%)`)
  }

  // Rug-shaped: tiny sellable float with huge locked creator allocation
  const locked = humanToBaseUnits(Math.max(0, lockedHuman), decimals)
  const remaining = supply.sub(totalSellA).sub(locked)
  if (remaining.lt(new BN(0))) {
    reasons.push('Sell + locked amounts exceed supply')
  }
  if (locked.gt(supply.muln(30).divn(100)) && sellFrac < 0.4) {
    reasons.push('High vesting lock with low sellable float looks rug-shaped')
  }

  if (reasons.length) return { ok: false, reasons }

  return {
    ok: true,
    params: {
      supply,
      totalSellA,
      totalFundRaisingB,
      decimals,
      totalLockedAmount: locked,
      cliffPeriod: new BN(Math.max(0, Math.floor(Number(input.cliffPeriodSec ?? 0)))),
      unlockPeriod: new BN(Math.max(0, Math.floor(Number(input.unlockPeriodSec ?? 0)))),
    },
  }
}
