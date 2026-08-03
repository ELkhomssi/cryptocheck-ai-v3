/**
 * Pure alert condition evaluation — safe for client + tests (no Redis).
 */

import type { AlertCondition } from './alert-types'

export function evaluateCondition(
  condition: AlertCondition,
  current: number | string,
): boolean {
  if (typeof current === 'string') {
    const target = String(condition.value)
    switch (condition.operator) {
      case '==':
        return current === target
      default:
        return false
    }
  }
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
