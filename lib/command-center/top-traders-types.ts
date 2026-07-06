export function truncateWallet(addr: string): string {
  if (addr.length <= 12) return addr
  if (addr.startsWith('0x')) return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export type TopTraderRow = {
  rank: number
  walletAddress: string
  volumeUsd: number
  swapCount: number
  sparkline: number[]
}

export type TopTradersResult =
  | { status: 'soon'; reason: string }
  | { status: 'live'; traders: TopTraderRow[]; label: string }
