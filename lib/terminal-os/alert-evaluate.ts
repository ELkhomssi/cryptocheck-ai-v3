/**
 * Pure alert condition evaluation — safe for client + tests (no Redis).
 */

import type { AlertCondition } from './alert-types'

export function evaluateCondition(condition: AlertCondition, current: number): boolean {
  const v = Number(condition.value)
  if (!Number.isFinite(v) || !Number.isFinite(current)) return false
  switch (condition.operator) {
    case '>':
      return current > v
    case '>=':
      return current >= v
    case '<':
      return current < v
    case '<=':
      return current <= v
    case '==':
      return current === v
    case 'crosses_above':
      return current >= v
    case 'crosses_below':
      return current <= v
    default:
      return false
  }
}
