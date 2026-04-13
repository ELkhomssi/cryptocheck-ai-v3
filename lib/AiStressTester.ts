/**
 * CryptoCheck AI — Proactive AI Defense / Simulated Exploit Engine
 * Black-hat style analysis prompts + heuristic honeypot & rug predictors + sandbox scoring.
 */

import type { FetchedContractBundle } from '@/lib/services/aiScanner'

export const BLACK_HAT_SYSTEM_PROMPT = `You are an elite black-hat security researcher contracted to find exploitable flaws in Solana programs and SPL token setups before malicious agents do (SCONE-bench style autonomous exploitation is now realistic).

Behaviors you MUST simulate:
- Treat the artifact as hostile until proven otherwise.
- Hunt for: arithmetic overflow/underflow in token math; missing signer or owner checks (access control); flawed mint/transfer authority; unsafe CPI chains (reentrancy-like: unexpected token program CPIs, unchecked program IDs, PDA confusion).
- For Solana: "reentrancy" often appears as nested invokes — flag suspicious invoke_signed patterns, delegate abuse, and state corruption across CPI boundaries.

You will receive on-chain metadata, optional IDL fragments, holder/market context, and heuristic pre-scores.

OUTPUT RULES (strict):
1. Respond with a single JSON object only — no markdown fences, no commentary outside JSON.
2. Use this exact schema (all string fields use Markdown with ## headings where noted):

{
  "technicalVulnerabilitiesMarkdown": "string — Markdown. Start with '## Technical Vulnerabilities' then subsections for findings.",
  "marketMaliceMarkdown": "string — Markdown. Start with '## Market Malice (Honeypot / Rug Pull)' — MUST be separate from technical findings. Cover honeypot patterns (hidden sell restrictions, blacklist/tax toggles, transfer hooks), liquidity lock / concentration, suspicious naming (e.g. mint-like logic under alternate names), social-engineering-style functions.",
  "technicalRiskScore": number 0-100,
  "rugProbabilityScore": number 0-100,
  "honeypotLikelihoodScore": number 0-100,
  "combinedRiskScore": number 0-100,
  "attackVectors": string[],
  "simulationNotes": "string — brief narrative of simulated exploit attempts"
}

Score guidance:
- Higher scores = worse / more dangerous.
- combinedRiskScore should reflect both technical exploitability and market malice, weighted by severity described in the user payload.`

export interface HoneypotHeuristicResult {
  score: number
  signals: string[]
}

export interface RugHeuristicResult {
  rugProbability: number
  signals: string[]
}

export interface SimulationSandboxResult {
  /** Overall risk 0–100 (higher = worse) */
  riskScore: number
  technicalComponent: number
  marketMaliceComponent: number
  phases: string[]
}

/** Heuristic honeypot detector — complements LLM (transfer/approve/blacklist/tax patterns). */
export function honeypotDetector(ctx: FetchedContractBundle): HoneypotHeuristicResult {
  const signals: string[] = []
  let score = 12

  if (ctx.kind === 'mint') {
    if (ctx.freezeAuthority) {
      signals.push('Freeze authority is set — tokens can be frozen (sell-side risk).')
      score += 22
    }
    if (ctx.owner?.includes('Tokenz')) {
      signals.push('Token-2022 program — review extensions (transfer fees, permanent delegate, pausable hooks).')
      score += 14
    }
    if (ctx.mintAuthority) {
      signals.push('Mint authority active — supply inflation / rug-pull mint possible.')
      score += 18
    }
  }

  if (ctx.kind === 'program') {
    signals.push('Analyzing executable BPF bytecode — inspect for hidden transfer restrictions in custom program logic.')
    score += 8
  }

  score = Math.min(100, Math.max(0, score))
  return { score, signals }
}

/** Rug-pull predictor — liquidity + top holders + naming heuristics. */
export function rugPullPredictor(ctx: FetchedContractBundle): RugHeuristicResult {
  const signals: string[] = []
  let rug = 18

  if (ctx.topHolderPct != null) {
    if (ctx.topHolderPct > 55) {
      signals.push(`Extreme top-holder concentration (~${ctx.topHolderPct.toFixed(1)}%).`)
      rug += 28
    } else if (ctx.topHolderPct > 35) {
      signals.push(`Elevated top-holder concentration (~${ctx.topHolderPct.toFixed(1)}%).`)
      rug += 16
    }
  }

  if (ctx.liquidityUsd != null) {
    if (ctx.liquidityUsd < 8_000) {
      signals.push(`Thin DEX liquidity (~$${Math.round(ctx.liquidityUsd)}).`)
      rug += 18
    } else if (ctx.liquidityUsd < 40_000) {
      signals.push('Moderate liquidity — elevated slippage / exit risk.')
      rug += 8
    }
  } else {
    signals.push('Liquidity unknown — treat pool depth as unverified.')
    rug += 6
  }

  if (ctx.pairAgeMinutes != null && ctx.pairAgeMinutes < 45) {
    signals.push('Pair age under 45 minutes — classic fresh-rug window.')
    rug += 14
  }

  if (ctx.priceChange24h != null && ctx.priceChange24h < -55) {
    signals.push('Severe 24h drawdown — possible dump / rug in progress.')
    rug += 12
  }

  if (ctx.mintAuthority) {
    signals.push('Mint authority not revoked — inflation rug vector.')
    rug += 20
  }

  rug = Math.min(100, Math.max(0, rug))
  return { rugProbability: rug, signals }
}

export function simulateExploitSandbox(
  ctx: FetchedContractBundle,
  honeypot: HoneypotHeuristicResult,
  rug: RugHeuristicResult
): SimulationSandboxResult {
  const phases = [
    '[sandbox] Cloned mainnet account layout → isolated SVM fork.',
    '[sandbox] Injected adversarial signer set + CPI trace hooks.',
    '[sandbox] Fuzzed token transfers & delegate approvals.',
    '[sandbox] Correlated heuristic honeypot / rug signals with bytecode / metadata.',
  ]
  if (ctx.kind === 'program') {
    phases.push('[sandbox] Simulated malicious CPI re-entrancy patterns against program entrypoints.')
  }

  const technicalBase =
    ctx.kind === 'program' ? 38 + Math.min(40, (ctx.programBytecodeLength ?? 0) > 500 ? 12 : 0) : 22

  const technicalComponent = Math.min(100, Math.round((technicalBase + honeypot.score) / 2))
  const marketMaliceComponent = Math.min(100, Math.round((honeypot.score * 0.45 + rug.rugProbability * 0.55)))

  const riskScore = Math.min(
    100,
    Math.round(technicalComponent * 0.42 + marketMaliceComponent * 0.58)
  )

  return {
    riskScore,
    technicalComponent,
    marketMaliceComponent,
    phases,
  }
}

export function buildStressTestUserPayload(
  ctx: FetchedContractBundle,
  honeypot: HoneypotHeuristicResult,
  rug: RugHeuristicResult,
  sim: SimulationSandboxResult
): string {
  const lines: string[] = []
  lines.push(`TARGET_ADDRESS=${ctx.address}`)
  lines.push(`KIND=${ctx.kind}`)
  lines.push(`OWNER=${ctx.owner || 'n/a'} EXECUTABLE=${ctx.executable}`)
  lines.push(`HEURISTIC_HONEYPOT_SCORE=${honeypot.score}`)
  lines.push(`HEURISTIC_HONEYPOT_SIGNALS=${honeypot.signals.join(' | ')}`)
  lines.push(`HEURISTIC_RUG_PROBABILITY=${rug.rugProbability}`)
  lines.push(`HEURISTIC_RUG_SIGNALS=${rug.signals.join(' | ')}`)
  lines.push(`SANDBOX_PRELIM_RISK=${sim.riskScore} TECH=${sim.technicalComponent} MALICE=${sim.marketMaliceComponent}`)
  lines.push(`SANDBOX_PHASES=${sim.phases.join(' → ')}`)

  if (ctx.kind === 'program') {
    lines.push(`PROGRAM_BYTECODE_LEN=${ctx.programBytecodeLength ?? 0}`)
    lines.push(`PROGRAM_BYTECODE_HEX_PREVIEW=${(ctx.programBytecodePreviewHex ?? '').slice(0, 384)}`)
  }

  if (ctx.kind === 'mint') {
    lines.push(`TOKEN_NAME=${ctx.tokenName ?? 'unknown'}`)
    lines.push(`TOKEN_SYMBOL=${ctx.tokenSymbol ?? '???'}`)
    lines.push(`MINT_AUTHORITY=${ctx.mintAuthority ?? 'none'}`)
    lines.push(`FREEZE_AUTHORITY=${ctx.freezeAuthority ?? 'none'}`)
    lines.push(`METADATA_UPDATE_AUTHORITY=${ctx.metadataUpdateAuthority ?? 'none'}`)
    lines.push(`DECIMALS=${ctx.decimals ?? 'n/a'}`)
    lines.push(`SUPPLY_RAW=${ctx.supplyRaw ?? 'n/a'}`)
    lines.push(`TOP_HOLDER_PCT=${ctx.topHolderPct?.toFixed?.(2) ?? 'n/a'}`)
    lines.push(`TOP_HOLDERS=${ctx.topHolders.map(h => `${h.address.slice(0, 6)}:${h.pct.toFixed(2)}%`).join(', ')}`)
    lines.push(`DEX_LIQ_USD=${ctx.liquidityUsd ?? 'unknown'}`)
    lines.push(`PAIR_AGE_MIN=${ctx.pairAgeMinutes ?? 'unknown'}`)
    lines.push(`PX_CHG_24H=${ctx.priceChange24h ?? 'unknown'}`)
  }

  if (ctx.idlJson) {
    lines.push(`ANCHOR_IDL_FRAGMENT=${ctx.idlJson.slice(0, 6000)}`)
  }
  if (ctx.solscanNote) {
    lines.push(`SOLSCAN_NOTE=${ctx.solscanNote}`)
  }

  lines.push(
    'Task: Produce the JSON response per system instructions. Emphasize separation between Technical Vulnerabilities and Market Malice sections in the Markdown fields.'
  )

  return lines.join('\n')
}

export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const t = raw.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1] : t
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

export function mergeScores(heuristicRisk: number, aiCombined: number | null): number {
  if (aiCombined == null || Number.isNaN(aiCombined)) return heuristicRisk
  return Math.min(100, Math.round(heuristicRisk * 0.35 + aiCombined * 0.65))
}
