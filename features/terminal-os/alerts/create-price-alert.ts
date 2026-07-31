/**
 * Shared helper — create a price Notify-me rule from any token context.
 */

import type { AlertRule } from '@/lib/terminal-os/alert-types'
import type { FocusedToken } from '@/stores/terminal-os'

export async function createPriceAlertFromToken(opts: {
  wallet: string
  token: Pick<FocusedToken, 'id' | 'symbol' | 'chain'>
  thresholdUsd: number
}): Promise<AlertRule> {
  const res = await fetch('/api/terminal-os/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: opts.wallet,
      type: 'price',
      condition: {
        field: 'price',
        operator: '>',
        value: opts.thresholdUsd,
      },
      target: {
        kind: 'token',
        id: opts.token.id,
        symbol: opts.token.symbol,
        chain: opts.token.chain,
      },
    }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? 'Failed to create alert')
  }
  const body = (await res.json()) as { rule: AlertRule }
  return body.rule
}
