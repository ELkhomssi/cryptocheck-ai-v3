/**
 * AI Gateway liveliness — presentation helpers only.
 * Every phase maps to a real Decision fetch / quote-assess / execution stage.
 * Never invent delays or decorative stage transitions.
 */

export type DecisionTickMeta = {
  at: string
  scanned: number
  published: number
  buyCount: number
  waitCount: number
}

export type GatewayPhase =
  | 'waiting'
  | 'thinking'
  | 'analyzing'
  | 'comparing'
  | 'validating'
  | 'ready'

export function gatewayPhase(opts: {
  hasBuyMint: boolean
  decisionLoading: boolean
  hasDecision: boolean
  quoteLoading: boolean
  /** Real ExecutionState from the swap path — only simulating maps to Validating */
  execState?: string
}): GatewayPhase {
  if (!opts.hasBuyMint) return 'waiting'
  if (opts.decisionLoading && !opts.hasDecision) return 'thinking'
  if (opts.decisionLoading && opts.hasDecision) return 'analyzing'
  if (opts.hasDecision && opts.quoteLoading) return 'comparing'
  if (opts.hasDecision && opts.execState === 'simulating') return 'validating'
  if (opts.hasDecision) return 'ready'
  return 'waiting'
}

export function phaseLabel(phase: GatewayPhase): string {
  switch (phase) {
    case 'thinking':
      return 'Thinking'
    case 'analyzing':
      return 'Analyzing'
    case 'comparing':
      return 'Comparing'
    case 'validating':
      return 'Validating'
    case 'ready':
      return 'Decision Ready'
    default:
      return 'Waiting'
  }
}

/**
 * Spoken summary — only real tickMeta counts; never stylized approximations.
 * Returns null when the engine has not published a cycle with scanned > 0.
 */
export function spokenSummary(
  meta: DecisionTickMeta | null,
  opts: { action?: string; symbol?: string } = {},
): string | null {
  if (!meta || !(meta.scanned > 0)) return null
  const focus = opts.symbol ? ` Focusing $${opts.symbol}.` : ''
  const actionBit = opts.action
    ? ` Current Decision: ${opts.action}${opts.symbol ? ` $${opts.symbol}` : ''}.`
    : ''
  return `I evaluated ${meta.scanned} tokens this cycle. ${meta.published} Decisions published — ${meta.buyCount} BUY, ${meta.waitCount} WAIT/DO_NOTHING.${actionBit}${focus}`
}
