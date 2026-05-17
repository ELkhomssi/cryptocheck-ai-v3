import { PublicKey } from '@solana/web3.js'
import { GRADUATION_LAMPORTS, LAMPORTS_PER_SOL } from '@/lib/web4/bonding-curve/constants'

/** Deployed Web4 Launchpad program (set after `anchor deploy`). */
export const WEB4_PROGRAM_ID_STR =
  process.env.NEXT_PUBLIC_WEB4_PROGRAM_ID ?? 'DjGTVwckj7649JhWomSaC89vTrD4abrvSpejFQS2armL'

export function getWeb4ProgramId(): PublicKey | null {
  try {
    return new PublicKey(WEB4_PROGRAM_ID_STR)
  } catch {
    return null
  }
}

export function isWeb4ProgramConfigured(): boolean {
  return getWeb4ProgramId() !== null
}

export const PUMP_TOTAL_SUPPLY = 1_000_000_000
export const PUMP_GRADUATION_SOL = Number(GRADUATION_LAMPORTS / LAMPORTS_PER_SOL)
export const PUMP_FEE_RATE = 0.01

/** Raydium AMM v4 (mainnet) — used for graduation CPI. */
export const RAYDIUM_AMM_PROGRAM_ID = new PublicKey(
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
)

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
)
