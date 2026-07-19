import 'server-only'

import { Connection, PublicKey } from '@solana/web3.js'
import { getPlatformFeeAccount } from '@/lib/trading/platform-fee-config'

/**
 * Jupiter platform fees require `feeAccount` to be an ATA for the *output* mint.
 * If missing / wrong mint → fail before disclose+sign (no silent zero-fee swap).
 */
export type FeeAccountCheck =
  | { ok: true; feeAccount: string }
  | { ok: false; code: 'FEE_ATA_MISSING' | 'FEE_ATA_MINT_MISMATCH' | 'FEE_NOT_CONFIGURED'; message: string }

function rpcUrl(): string {
  return (
    process.env.HELIUS_RPC_URL?.trim() ||
    process.env.SOLANA_RPC_URL?.trim() ||
    'https://api.mainnet-beta.solana.com'
  )
}

export async function assertPlatformFeeAccountForOutput(
  outputMint: string,
): Promise<FeeAccountCheck> {
  const feeAccount = getPlatformFeeAccount()
  if (!feeAccount) {
    return {
      ok: false,
      code: 'FEE_NOT_CONFIGURED',
      message: 'Platform fee account not configured',
    }
  }

  const connection = new Connection(rpcUrl(), 'confirmed')
  let pubkey: PublicKey
  try {
    pubkey = new PublicKey(feeAccount)
  } catch {
    return { ok: false, code: 'FEE_ATA_MISSING', message: 'Invalid PLATFORM_FEE_ACCOUNT' }
  }

  const info = await connection.getParsedAccountInfo(pubkey, 'confirmed')
  if (!info.value) {
    return {
      ok: false,
      code: 'FEE_ATA_MISSING',
      message:
        'Fee account ATA does not exist for this route. Run npm run create:referral-ata for this output mint before collecting fees.',
    }
  }

  const parsed = info.value.data
  if (typeof parsed === 'object' && parsed !== null && 'parsed' in parsed) {
    const mint = (parsed as { parsed?: { info?: { mint?: string } } }).parsed?.info?.mint
    if (mint && mint !== outputMint) {
      return {
        ok: false,
        code: 'FEE_ATA_MINT_MISMATCH',
        message: `Fee ATA is for mint ${mint.slice(0, 8)}… but swap output is ${outputMint.slice(0, 8)}…. Create a referral ATA for this token or the fee cannot be collected.`,
      }
    }
  }

  return { ok: true, feeAccount }
}
