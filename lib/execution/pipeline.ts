/**
 * Prepare-only execution pipeline (non-custodial).
 *
 * Flow: intake → risk → capital → strategy wait → simulate → safety → build unsigned
 * Client signs; optional Jito/RPC submit after signature is a separate step.
 */
import 'server-only'

import {
  buildJupiterSwapTransaction,
  getJupiterQuote,
} from '@/lib/trading/jupiter-client'
import { simulateSerializedSwapTransaction } from '@/lib/services/swap-simulation'
import { Connection, VersionedTransaction } from '@solana/web3.js'
import { SOL_MINT, getPlatformFeeBps, isPlatformFeeConfigured } from '@/lib/trading/platform-fee-config'
import { assertPlatformFeeAccountForOutput } from '@/lib/launchpad/fee-account'
import { checkCapitalLimits, loadCapitalPolicy } from './capital'
import { planJitoExecution, jitoPrioritizationOption, type CongestionLevel } from './jito'
import { computeSafetyScore, validateOpportunityRisk } from './risk-adapter'
import type { PreparedExecution } from './ports'
import type { OpportunityIntake, SimulationReport } from './types'
import { DEFAULT_STRATEGY_CONFIGS } from './types'

function rpcUrl(): string {
  return (
    process.env.HELIUS_RPC_URL?.trim() ||
    process.env.SOLANA_RPC_URL?.trim() ||
    'https://api.mainnet-beta.solana.com'
  )
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise((r) => setTimeout(r, ms))
}

export async function prepareExecution(
  opp: OpportunityIntake,
  opts?: { congestion?: CongestionLevel },
): Promise<PreparedExecution> {
  const cfg = DEFAULT_STRATEGY_CONFIGS[opp.strategy]

  // 1) Risk — scan gateway only
  const risk = await validateOpportunityRisk(opp)
  if (risk.category === 'critical' || risk.verdict === 'BLOCKED' || risk.verdict === 'DANGER') {
    return {
      auditId: opp.opportunityId,
      opportunityId: opp.opportunityId,
      allowed: false,
      blockReason: `Critical/blocked risk (${risk.riskScore}) — never executable`,
      risk,
      simulation: null,
      safety: null,
      capital: null,
      jitoPlan: null,
    }
  }

  // 2) Capital
  const policy = await loadCapitalPolicy(opp.userId)
  const capital = await checkCapitalLimits(opp, policy)
  if (!capital.ok) {
    return {
      auditId: opp.opportunityId,
      opportunityId: opp.opportunityId,
      allowed: false,
      blockReason: capital.reasons.join('; '),
      risk,
      simulation: null,
      safety: null,
      capital,
      jitoPlan: null,
    }
  }

  // 3) Strategy wait (post-dump / stabilize)
  if (cfg.stabilizeWaitMs > 0) {
    await sleep(cfg.stabilizeWaitMs)
  }

  // 4) Build quote + unsigned tx + simulate
  const amountSol = opp.amountSol ?? 0
  if (opp.side !== 'buy' || amountSol <= 0) {
    return {
      auditId: opp.opportunityId,
      opportunityId: opp.opportunityId,
      allowed: false,
      blockReason: 'Only SOL→mint buys are prepared in v1 pipeline',
      risk,
      simulation: null,
      safety: null,
      capital,
      jitoPlan: null,
    }
  }

  let feeAccount: string | null = null
  let feeBps = 0
  if (isPlatformFeeConfigured()) {
    const check = await assertPlatformFeeAccountForOutput(opp.mint)
    if (check.ok === false) {
      return {
        auditId: opp.opportunityId,
        opportunityId: opp.opportunityId,
        allowed: false,
        blockReason: check.message,
        risk,
        simulation: null,
        safety: null,
        capital,
        jitoPlan: null,
      }
    }
    feeAccount = check.feeAccount
    feeBps = getPlatformFeeBps()
  }

  const jitoPlan = planJitoExecution(opp, {
    congestion: opts?.congestion ?? 'medium',
  })
  if (jitoPlan.fallback === 'abort') {
    return {
      auditId: opp.opportunityId,
      opportunityId: opp.opportunityId,
      allowed: false,
      blockReason: 'Extreme congestion — abort per Jito degradation policy',
      risk,
      simulation: null,
      safety: null,
      capital,
      jitoPlan,
    }
  }

  const lamports = Math.floor(amountSol * 1e9)
  const quote = await getJupiterQuote(SOL_MINT, opp.mint, lamports, opp.maxSlippageBps, {
    platformFeeBps: feeAccount ? feeBps : undefined,
  })
  const impactPct = Number(quote.priceImpactPct) * 100
  if (impactPct > cfg.maxPriceImpactPct) {
    return {
      auditId: opp.opportunityId,
      opportunityId: opp.opportunityId,
      allowed: false,
      blockReason: `Price impact ${impactPct.toFixed(2)}% > strategy max ${cfg.maxPriceImpactPct}%`,
      risk,
      simulation: null,
      safety: null,
      capital,
      jitoPlan,
    }
  }

  const prio = jitoPrioritizationOption(jitoPlan)
  const unsignedTxBase64 = await buildJupiterSwapTransaction(quote, opp.walletAddress, {
    ...(feeAccount ? { feeAccount } : {}),
    ...(prio != null ? { prioritizationFeeLamports: prio } : {}),
  })

  const connection = new Connection(rpcUrl(), 'confirmed')
  const simRpc = await simulateSerializedSwapTransaction(connection, unsignedTxBase64)
  const simOk = simRpc.ran && !simRpc.sellSimulationFailed
  const simulation: SimulationReport = {
    opportunityId: opp.opportunityId,
    ok: simOk,
    confidence: simOk ? (impactPct < 0.5 ? 0.95 : impactPct < 1.5 ? 0.88 : 0.75) : 0.2,
    expectedOutAmountBase: quote.outAmount,
    minOutAmountBase: quote.otherAmountThreshold,
    priceImpactPct: impactPct,
    unitsConsumed: simRpc.unitsConsumed ?? null,
    rpcErr: simOk ? null : simRpc.rpcError ?? 'simulation_failed',
    honeypotSuspect: simRpc.sellSimulationFailed,
    simulatedAt: new Date().toISOString(),
  }

  if (!simulation.ok || simulation.confidence < cfg.minSimulationConfidence) {
    return {
      auditId: opp.opportunityId,
      opportunityId: opp.opportunityId,
      allowed: false,
      blockReason: simulation.rpcErr
        ? `Simulation failed: ${simulation.rpcErr}`
        : `Simulation confidence ${simulation.confidence} < ${cfg.minSimulationConfidence}`,
      risk,
      simulation,
      safety: null,
      capital,
      jitoPlan,
      unsignedTxBase64,
    }
  }

  // 5) Safety score
  const safety = await computeSafetyScore(opp, risk, cfg)
  if (!safety.passed) {
    return {
      auditId: opp.opportunityId,
      opportunityId: opp.opportunityId,
      allowed: false,
      blockReason: `Safety score ${safety.score} < ${safety.thresholdRequired}`,
      risk,
      simulation,
      safety,
      capital,
      jitoPlan,
      unsignedTxBase64,
    }
  }

  // Soft re-check already covered by gateway risk + capital + sim + safety gates.
  return {
    auditId: opp.opportunityId,
    opportunityId: opp.opportunityId,
    allowed: true,
    unsignedTxBase64,
    risk,
    simulation,
    safety,
    capital,
    jitoPlan,
  }
}

/** Deserialize helper for clients that need VersionedTransaction locally. */
export function decodeUnsignedTx(base64: string): VersionedTransaction {
  return VersionedTransaction.deserialize(Buffer.from(base64, 'base64'))
}
