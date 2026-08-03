/**
 * Pure Money Lifecycle derivation — maps existing engine outputs → ribbon nodes.
 * No new scores; honesty states when data is missing.
 */

import type { ExecutionState } from '@/features/execution-desk/types'
import { IN_FLIGHT_EXECUTION } from './execution-lifecycle-bridge'
import {
  LIFECYCLE_STAGES,
  type LifecycleDerived,
  type LifecycleGroupId,
  type LifecycleNodeStatus,
  type LifecycleNodeView,
  type LifecycleSnapshot,
  type LifecycleStageId,
} from './types'

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function formatPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function topStyle(dna: NonNullable<LifecycleSnapshot['dna']>): string {
  const entries = Object.entries(dna.styleVector) as [string, number][]
  entries.sort((a, b) => b[1] - a[1])
  const top = entries[0]
  if (!top || top[1] <= 0) return dna.tradingStyleSummary || 'Style forming'
  return `${top[0]} ${(top[1] * 100).toFixed(0)}%`
}

/** Real-state priority — never a timed animation. */
export function decideActiveStage(snap: LifecycleSnapshot): LifecycleStageId {
  if (IN_FLIGHT_EXECUTION.has(snap.executionState)) return 'executes'
  if (snap.decision) return 'decides'
  if (snap.marketContext) return 'market'
  if (snap.dna && snap.dna.sampleSize >= 1) return 'you'
  if (snap.portfolio || snap.portfolioLoading) return 'capital'
  if (snap.walletConnected) return 'capital'
  return 'enters'
}

function groupFor(stage: LifecycleStageId): LifecycleGroupId {
  return LIFECYCLE_STAGES.find((s) => s.id === stage)?.group ?? 'enters'
}

export function deriveLifecycle(snap: LifecycleSnapshot): LifecycleDerived {
  const activeStageId = decideActiveStage(snap)
  const nodes: LifecycleNodeView[] = LIFECYCLE_STAGES.map((meta) => {
    const built = buildNode(meta.id, snap)
    let status: LifecycleNodeStatus = built.status
    // Pulse gold only when the active stage has real live work (not idle/config gaps)
    if (meta.id === activeStageId && (status === 'ready' || status === 'active')) {
      status = 'active'
    }
    return { ...built, meta, status }
  })

  return {
    nodes,
    activeStageId,
    activeGroupId: groupFor(activeStageId),
  }
}

function buildNode(
  id: LifecycleStageId,
  snap: LifecycleSnapshot,
): Omit<LifecycleNodeView, 'meta' | 'status'> & { status: LifecycleNodeStatus } {
  switch (id) {
    case 'enters':
      return stageEnters(snap)
    case 'capital':
      return stageCapital(snap)
    case 'you':
      return stageYou(snap)
    case 'market':
      return stageMarket(snap)
    case 'decides':
      return stageDecides(snap)
    case 'executes':
      return stageExecutes(snap)
    case 'grows':
      return stageGrows(snap)
    case 'exits':
      return stageExits(snap)
  }
}

function stageEnters(snap: LifecycleSnapshot) {
  if (!snap.walletConnected) {
    return {
      status: 'needs_wallet' as const,
      headline: 'Connect wallet to begin',
      detailLines: [
        'Non-custodial — your keys, your wallet.',
        'Buy crypto via a licensed on-ramp when configured; funds land in your wallet.',
      ],
      ctaLabel: 'Connect Wallet',
    }
  }
  const bal =
    snap.cashReadyUsd != null ? `Wallet balance ${formatUsd(snap.cashReadyUsd)}` : 'Wallet connected'
  if (!snap.ramp.configured) {
    return {
      status: 'needs_config' as const,
      headline: bal,
      detailLines: [
        'Licensed on-ramp not configured (set NEXT_PUBLIC_MOONPAY_API_KEY, TRANSAK, or RAMP).',
        'Cash Ready shows your real wallet balance — CryptoCheck never holds funds.',
      ],
    }
  }
  return {
    status: 'ready' as const,
    headline: bal,
    detailLines: [
      `Deposit / Buy Crypto via ${snap.ramp.provider} — funds go to your connected wallet.`,
      'Not financial advice · DYOR',
    ],
    ctaLabel: 'Buy crypto',
    ctaExternalUrl: snap.ramp.buyUrl ?? undefined,
  }
}

function stageCapital(snap: LifecycleSnapshot) {
  if (!snap.walletConnected) {
    return {
      status: 'needs_wallet' as const,
      headline: 'Connect and trade to activate',
      detailLines: ['Portfolio Intelligence reads live holdings after wallet connect.'],
    }
  }
  if (snap.portfolioLoading && !snap.portfolio) {
    return {
      status: 'insufficient_data' as const,
      headline: 'Loading portfolio intelligence…',
      detailLines: ['Fetching live holdings — no placeholder scores shown.'],
    }
  }
  if (!snap.portfolio) {
    return {
      status: 'insufficient_data' as const,
      headline: 'Not enough data yet',
      detailLines: ['Holdings unavailable for this wallet right now.'],
    }
  }
  const p = snap.portfolio
  return {
    status: 'ready' as const,
    headline: `${formatUsd(p.totalAssetsUsd)} · health ${p.aiHealthScore}`,
    detailLines: [
      `Diversification ${p.diversificationScore} · stability ${p.stabilityScore}`,
      p.healthWhy,
    ],
    ctaLabel: 'Open Portfolio',
    ctaHref: 'portfolio',
  }
}

function stageYou(snap: LifecycleSnapshot) {
  if (!snap.walletConnected) {
    return {
      status: 'needs_wallet' as const,
      headline: 'Connect and trade to activate',
      detailLines: ['Trader DNA needs on-chain history from your wallet.'],
    }
  }
  const dna = snap.dna
  if (!dna || dna.sampleSize < 1) {
    return {
      status: 'insufficient_data' as const,
      headline: 'Not enough data yet',
      detailLines: [
        'Train Trade Like Me on your wallet history to build Trader DNA.',
        'No fabricated style or confidence shown.',
      ],
      ctaLabel: 'Open Trade Like Me',
      ctaHref: 'ai-trading',
    }
  }
  return {
    status: 'ready' as const,
    headline: `${topStyle(dna)} · risk ${dna.riskAppetiteLabel}`,
    detailLines: [
      `Confidence ${Math.round(dna.confidence)}% · sample size ${dna.sampleSize}`,
      dna.tradingStyleSummary,
    ],
    ctaLabel: 'Open Trade Like Me',
    ctaHref: 'ai-trading',
  }
}

function stageMarket(snap: LifecycleSnapshot) {
  const m = snap.marketContext
  if (!m) {
    return {
      status: 'insufficient_data' as const,
      headline: 'Not enough data yet',
      detailLines: [
        'MarketContext appears after Trade Like Me scores a live token (same object the Decision Engine uses).',
      ],
      ctaLabel: 'Score market',
      ctaHref: 'ai-trading',
    }
  }
  return {
    status: 'ready' as const,
    headline: `$${m.tokenSymbol} · ${m.securityBand} · whales ${m.whaleBias}`,
    detailLines: [
      `Smart money ${Math.round(m.smartMoneyScore)} · risk ${Math.round(m.riskScore)} · flow ${m.orderFlowBias}`,
      `Liquidity ${m.liquidityTrend} · sources ${m.sources.slice(0, 3).join(', ') || 'live'}`,
    ],
    ctaLabel: 'Open Market Intel',
    ctaHref: 'market-intel',
  }
}

function stageDecides(snap: LifecycleSnapshot) {
  const d = snap.decision
  if (!d) {
    return {
      status: 'insufficient_data' as const,
      headline: 'Not enough data yet',
      detailLines: ['Canonical Decision appears after a Decision Engine run.'],
      ctaLabel: 'Open Trade Like Me',
      ctaHref: 'ai-trading',
    }
  }
  const degradedNote = d.degraded
    ? `Degraded inputs: ${(d.degradedInputs ?? []).join(', ') || 'partial'}`
    : null
  return {
    status: 'ready' as const,
    headline: `${d.action}, confidence ${Math.round(d.scores.confidence)}%${d.degraded ? ' · degraded' : ''}`,
    detailLines: [
      d.summary,
      degradedNote || d.reasons[0] || 'See Trade Like Me for full explainable citations.',
    ],
    ctaLabel: 'View decision',
    ctaHref: 'ai-trading',
  }
}

function stageExecutes(snap: LifecycleSnapshot) {
  const s = snap.executionState
  if (IN_FLIGHT_EXECUTION.has(s)) {
    return {
      status: 'active' as const,
      headline: execLabel(s),
      detailLines: [
        'Secure Execution lifecycle — simulate → sign → broadcast → confirm.',
        'Non-custodial: your wallet signs; CryptoCheck never holds funds.',
      ],
      ctaLabel: 'Open Execution Desk',
      ctaHref: 'execution',
    }
  }
  if (s === 'confirmed') {
    return {
      status: 'ready' as const,
      headline: 'Confirmed on-chain',
      detailLines: ['Last Secure Execution confirmed. Review signature in Execution Desk.'],
      ctaLabel: 'Open Execution Desk',
      ctaHref: 'execution',
    }
  }
  if (s === 'failed' || s === 'reverted' || s === 'simulation_failed') {
    return {
      status: 'ready' as const,
      headline: execLabel(s),
      detailLines: ['Execution did not complete — review Simulation / risk gate in Execution Desk.'],
      ctaLabel: 'Open Execution Desk',
      ctaHref: 'execution',
    }
  }
  if (!snap.walletConnected) {
    return {
      status: 'needs_wallet' as const,
      headline: 'Connect wallet to execute',
      detailLines: ['Execution Desk uses the same Jupiter risk-gated swap engine.'],
    }
  }
  return {
    status: 'idle' as const,
    headline: 'Ready when you are',
    detailLines: [
      'AI Executes is a distinct beat from AI Decides — only pulses while a real ExecutionState is in-flight.',
    ],
    ctaLabel: 'Open Execution Desk',
    ctaHref: 'execution',
  }
}

function stageGrows(snap: LifecycleSnapshot) {
  const perf = snap.performance
  if (perf && !perf.sample) {
    return {
      status: 'ready' as const,
      headline: `AI vs you ${formatPct(perf.alphaVsSelfPct)} alpha`,
      detailLines: [
        perf.proofLine,
        `AI ROI ${formatPct(perf.aiFollowRoiPct)} · baseline ${formatPct(perf.traderBaselineRoiPct)}`,
      ],
      ctaLabel: 'Open Trade Like Me',
      ctaHref: 'ai-trading',
    }
  }
  if (snap.portfolio) {
    return {
      status: 'ready' as const,
      headline: `24h PnL ${formatUsd(snap.portfolio.pnl24hUsd)} (${formatPct(snap.portfolio.pnl24hPct)})`,
      detailLines: [
        'From live holdings mark-to-market — Performance Analytics full AI-vs-baseline unlocks with trade history.',
        snap.portfolio.stabilityWhy,
      ],
      ctaLabel: 'Open Portfolio',
      ctaHref: 'portfolio',
    }
  }
  if (perf?.sample) {
    return {
      status: 'insufficient_data' as const,
      headline: 'Not enough data yet',
      detailLines: ['Performance model is sample-tagged — waiting for real trade history.'],
      ctaLabel: 'Train Trade Like Me',
      ctaHref: 'ai-trading',
    }
  }
  return {
    status: 'insufficient_data' as const,
    headline: 'Not enough data yet',
    detailLines: [
      'Connect a wallet with holdings or train Trade Like Me to unlock growth analytics.',
    ],
  }
}

function stageExits(snap: LifecycleSnapshot) {
  if (!snap.walletConnected) {
    return {
      status: 'needs_wallet' as const,
      headline: 'Connect wallet to withdraw',
      detailLines: [
        'Available to Withdraw = your real wallet balance.',
        'Off-ramp is licensed third-party — CryptoCheck never custodies fiat or crypto.',
      ],
    }
  }
  const bal =
    snap.cashReadyUsd != null
      ? `Available to Withdraw ${formatUsd(snap.cashReadyUsd)}`
      : 'Wallet connected'
  if (!snap.ramp.configured) {
    return {
      status: 'needs_config' as const,
      headline: bal,
      detailLines: [
        'Licensed off-ramp not configured (MoonPay / Transak / Ramp env key).',
        'Your funds remain in your wallet until you use a provider.',
      ],
    }
  }
  return {
    status: 'ready' as const,
    headline: bal,
    detailLines: [
      `Cash out via ${snap.ramp.provider} — proceeds go to your bank/card per provider, from your wallet.`,
      'Not financial advice · DYOR',
    ],
    ctaLabel: 'Sell / cash out',
    ctaExternalUrl: snap.ramp.sellUrl ?? undefined,
  }
}

function execLabel(s: ExecutionState): string {
  switch (s) {
    case 'simulating':
      return 'Simulating…'
    case 'awaiting_signature':
      return 'Awaiting signature…'
    case 'broadcasting':
      return 'Broadcasting…'
    case 'pending_confirmation':
      return 'Pending confirmation…'
    case 'confirmed':
      return 'Confirmed'
    case 'simulation_failed':
      return 'Simulation failed'
    case 'failed':
      return 'Failed'
    case 'reverted':
      return 'Reverted'
    default:
      return 'Building'
  }
}
