/**
 * Pump.fun-style constant-product bonding curve (virtual reserves).
 * 1B supply · 85 SOL graduation target · quadratic price discovery via x*y=k.
 */

export const PUMP_TOTAL_SUPPLY = 1_000_000_000
export const PUMP_GRADUATION_SOL = 85
export const PUMP_VIRTUAL_SOL = 30
export const PUMP_VIRTUAL_TOKEN = 1_073_000_191
export const PUMP_FEE_RATE = 0.01
export const MAD_PER_USD = 10.05

export type BondingToken = {
  mint: string
  name: string
  ticker: string
  description: string
  emoji: string
  gradient: string
  virtualSol: number
  virtualToken: number
  realSolRaised: number
  tokensSold: number
  volumeSol: number
  graduated: boolean
  launchSol: number
  openPriceSol: number
  createdAt: number
}

export function mintAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let s = ''
  for (let i = 0; i < 44; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export function priceSol(token: BondingToken): number {
  if (token.virtualToken <= 0) return 0
  return token.virtualSol / token.virtualToken
}

export function progressPct(token: BondingToken): number {
  if (token.graduated) return 100
  return Math.min(100, (token.realSolRaised / PUMP_GRADUATION_SOL) * 100)
}

export function marketCapUsd(token: BondingToken, solUsd: number): number {
  return priceSol(token) * solUsd * PUMP_TOTAL_SUPPLY
}

export function createBondingToken(input: {
  name: string
  ticker: string
  description: string
  initialLiquiditySol: number
  emoji?: string
  gradient?: string
}): BondingToken {
  const mint = mintAddress()
  const launchSol = Math.max(0.1, input.initialLiquiditySol)
  const base: BondingToken = {
    mint,
    name: input.name.trim() || 'New Token',
    ticker: input.ticker.trim().toUpperCase().slice(0, 6) || 'NEW',
    description: input.description.trim(),
    emoji: input.emoji ?? '🚀',
    gradient: input.gradient ?? 'from-cyan-500 to-emerald-500',
    virtualSol: PUMP_VIRTUAL_SOL,
    virtualToken: PUMP_VIRTUAL_TOKEN,
    realSolRaised: 0,
    tokensSold: 0,
    volumeSol: 0,
    graduated: false,
    launchSol,
    openPriceSol: 0,
    createdAt: Date.now(),
  }
  const { next } = applyBuy(base, launchSol, true)
  return { ...next, launchSol, openPriceSol: priceSol(next) }
}

export function applyBuy(
  token: BondingToken,
  solIn: number,
  skipWallet = false,
): { tokensOut: number; solSpent: number; next: BondingToken; price: number; graduated: boolean } {
  if (token.graduated || solIn <= 0) {
    return { tokensOut: 0, solSpent: 0, next: token, price: priceSol(token), graduated: token.graduated }
  }
  const fee = solIn * PUMP_FEE_RATE
  const netSol = Math.max(0, solIn - fee)
  const k = token.virtualSol * token.virtualToken
  const newVirtualSol = token.virtualSol + netSol
  const newVirtualToken = k / newVirtualSol
  const tokensOut = token.virtualToken - newVirtualToken
  const realSolRaised = Math.min(PUMP_GRADUATION_SOL, token.realSolRaised + netSol)
  const graduated = realSolRaised >= PUMP_GRADUATION_SOL
  const next: BondingToken = {
    ...token,
    virtualSol: newVirtualSol,
    virtualToken: newVirtualToken,
    realSolRaised,
    tokensSold: token.tokensSold + tokensOut,
    volumeSol: token.volumeSol + solIn,
    graduated,
  }
  return {
    tokensOut,
    solSpent: skipWallet ? 0 : solIn,
    next,
    price: priceSol(next),
    graduated,
  }
}

export function applySell(
  token: BondingToken,
  tokenIn: number,
): { solOut: number; next: BondingToken; price: number } {
  if (token.graduated || tokenIn <= 0) {
    return { solOut: 0, next: token, price: priceSol(token) }
  }
  const k = token.virtualSol * token.virtualToken
  const newVirtualToken = token.virtualToken + tokenIn
  const newVirtualSol = k / newVirtualToken
  let solOut = token.virtualSol - newVirtualSol
  const fee = solOut * PUMP_FEE_RATE
  solOut = Math.max(0, solOut - fee)
  const next: BondingToken = {
    ...token,
    virtualSol: newVirtualSol,
    virtualToken: newVirtualToken,
    tokensSold: Math.max(0, token.tokensSold - tokenIn),
    volumeSol: token.volumeSol + solOut,
    realSolRaised: Math.max(0, token.realSolRaised - solOut * 0.98),
  }
  return { solOut, next, price: priceSol(next) }
}

/** Quote buy without mutating state */
export function quoteBuy(token: BondingToken, solIn: number): number {
  return applyBuy(token, solIn, true).tokensOut
}

/** Quote sell without mutating state */
export function quoteSell(token: BondingToken, tokenIn: number): number {
  return applySell(token, tokenIn).solOut
}

export function change24hPct(token: BondingToken): number {
  const p = priceSol(token)
  if (token.openPriceSol <= 0) return 0
  return ((p - token.openPriceSol) / token.openPriceSol) * 100
}

export const GRADIENTS = [
  'from-cyan-500 to-emerald-500',
  'from-violet-500 to-fuchsia-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-indigo-500',
] as const

export const EMOJIS = ['🚀', '🐸', '🐕', '🐱', '💨', '⚡', '🌙', '🔥'] as const

export function seedDefaultTokens(): Record<string, BondingToken> {
  const specs = [
    { name: 'Neural Pepe', ticker: 'NPEPE', emoji: '🐸', gradient: GRADIENTS[0], sol: 12 },
    { name: 'Safe Moon AI', ticker: 'SMAI', emoji: '🌙', gradient: GRADIENTS[1], sol: 28 },
    { name: 'Circuit Doge', ticker: 'CDOGE', emoji: '🐕', gradient: GRADIENTS[2], sol: 8 },
    { name: 'Vault Cat', ticker: 'VCAT', emoji: '🐱', gradient: GRADIENTS[3], sol: 19 },
    { name: 'Quantum Chad', ticker: 'QCHAD', emoji: '⚡', gradient: GRADIENTS[4], sol: 41 },
  ]
  const map: Record<string, BondingToken> = {}
  for (const s of specs) {
    const t = createBondingToken({
      name: s.name,
      ticker: s.ticker,
      description: 'CryptoCheck safe-launch seed',
      initialLiquiditySol: s.sol,
      emoji: s.emoji,
      gradient: s.gradient,
    })
    // extra activity toward curve
    const extra = applyBuy(t, randSol(2, 8), true)
    map[extra.next.mint] = extra.next
  }
  return map
}

function randSol(min: number, max: number) {
  return min + Math.random() * (max - min)
}

export const BOT_WALLETS = [
  '7xKP…8gQw',
  '3nRT…4mPL',
  'DeFi…9hWs',
  'BotA…3kRf',
  'HkGz…x15i',
  '5jWw…x15i',
  'KX2m…2eNs',
  'APiY…4MH',
] as const

export function randomBotWallet(): string {
  return BOT_WALLETS[Math.floor(Math.random() * BOT_WALLETS.length)]
}
