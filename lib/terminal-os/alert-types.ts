/**
 * Terminal OS alert rules — real contracts (not portfolio_alerts Helius feed).
 */

export type AlertRuleType =
  | 'price'
  | 'whale_movement'
  | 'security_flag'
  | 'ai_signal'
  | 'portfolio_risk'

export type AlertCondition = {
  field: string
  operator: '>' | '>=' | '<' | '<=' | '==' | 'crosses_above' | 'crosses_below'
  value: number | string | boolean
}

export type AlertTargetRef = {
  kind: 'token' | 'wallet'
  id: string
  symbol?: string
  chain?: string
}

export type AlertRule = {
  id: string
  wallet: string
  type: AlertRuleType
  condition: AlertCondition
  target: AlertTargetRef
  active: boolean
  createdAt: string
}

export type FiredAlert = {
  id: string
  ruleId: string
  wallet: string
  firedAt: string
  triggerValue: unknown
  delivered: boolean
  summary: string
}
