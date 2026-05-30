/** Lamports (9 decimals) and token base units (6 decimals). */

export const LAMPORTS_PER_SOL = 1_000_000_000n
export const TOKEN_DECIMALS = 6
export const TOKEN_SCALE = 10n ** BigInt(TOKEN_DECIMALS)

export const TOTAL_SUPPLY_TOKENS = 1_000_000_000n
export const TOTAL_SUPPLY_BASE = TOTAL_SUPPLY_TOKENS * TOKEN_SCALE

/** Pump.fun-aligned virtual reserves (base units). */
export const VIRTUAL_SOL_LAMPORTS = 30n * LAMPORTS_PER_SOL
export const VIRTUAL_TOKEN_BASE = 1_073_000_191n * TOKEN_SCALE

export const GRADUATION_SOL = 85n
export const GRADUATION_LAMPORTS = GRADUATION_SOL * LAMPORTS_PER_SOL

/** 1% protocol fee on buys/sells (basis points). */
export const FEE_BPS = 100n
export const BPS_DENOM = 10_000n

export const MAD_PER_USD = 10.05
