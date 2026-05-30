import type { TradeRow } from '@/app/dashboard/web4-terminal/terminal-types'
import { formatClock, uid } from '@/app/dashboard/web4-terminal/terminal-utils'
import { baseToTokens, lamportsToSol } from '@/lib/web4/bonding-curve/math'

/** Parse Anchor `TradeEvent` from program logs (simplified). */
export function tradeRowFromLogs(
  logs: string[],
  wallet: string,
  mint: string,
): TradeRow | null {
  const line = logs.find((l) => l.includes('amount_in') || l.includes('TradeEvent'))
  if (!line) {
    const isBuy = logs.some((l) => l.toLowerCase().includes('buy'))
    const isSell = logs.some((l) => l.toLowerCase().includes('sell'))
    if (!isBuy && !isSell) return null
    return {
      id: uid(),
      price: 0,
      amount: 0,
      total: 0,
      side: isSell ? 'sell' : 'buy',
      depth: 0.5,
      wallet: wallet.slice(0, 4) + '…' + wallet.slice(-4),
      time: formatClock(),
      age: '0s',
    }
  }

  const side = logs.some((l) => l.includes('side: 1')) ? 'sell' : 'buy'
  const inMatch = line.match(/amount_in:\s*(\d+)/)
  const outMatch = line.match(/amount_out:\s*(\d+)/)
  const amountIn = inMatch ? BigInt(inMatch[1]) : 0n
  const amountOut = outMatch ? BigInt(outMatch[1]) : 0n

  if (side === 'buy') {
    const sol = lamportsToSol(amountIn)
    const tokens = baseToTokens(amountOut)
    return {
      id: uid(),
      price: tokens > 0 ? sol / tokens : 0,
      amount: tokens,
      total: sol,
      side: 'buy',
      depth: 0.6,
      wallet: wallet.slice(0, 4) + '…' + wallet.slice(-4),
      time: formatClock(),
      age: '0s',
    }
  }

  const tokens = baseToTokens(amountIn)
  const sol = lamportsToSol(amountOut)
  return {
    id: uid(),
    price: tokens > 0 ? sol / tokens : 0,
    amount: tokens,
    total: sol,
    side: 'sell',
    depth: 0.6,
    wallet: wallet.slice(0, 4) + '…' + wallet.slice(-4),
    time: formatClock(),
    age: '0s',
  }
}
