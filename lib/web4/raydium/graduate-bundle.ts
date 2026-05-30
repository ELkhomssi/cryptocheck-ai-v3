import {
  Connection,
  PublicKey,
  Transaction,
  type TransactionInstruction,
} from '@solana/web3.js'
import { buildGraduateInstruction } from '@/lib/web4/protocol/instructions'
import { RAYDIUM_AMM_PROGRAM_ID } from '@/lib/web4/protocol/config'

/**
 * Production graduation bundle:
 * 1. `graduate` on Web4 program (locks curve, emits event)
 * 2. Raydium AMM initialize + add liquidity (keeper / authority)
 * 3. Burn 100% LP tokens to incinerator
 *
 * Steps 2–3 require Raydium SDK CPI or pre-built templates; wire after program deploy.
 */
export async function buildGraduationBundle(params: {
  connection: Connection
  authority: PublicKey
  mint: PublicKey
}): Promise<TransactionInstruction[]> {
  const graduateIx = buildGraduateInstruction({
    authority: params.authority,
    mint: params.mint,
  })

  // Placeholder: append Raydium `initialize2` + `deposit` + LP burn when SDK is enabled.
  void params.connection
  void RAYDIUM_AMM_PROGRAM_ID

  return [graduateIx]
}

export async function simulateGraduationBundle(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
): Promise<{ ok: boolean; logs?: string[] }> {
  const ixs = await buildGraduationBundle({ connection, authority: payer, mint })
  const tx = new Transaction().add(...ixs)
  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = payer
  const sim = await connection.simulateTransaction(tx)
  return { ok: !sim.value.err, logs: sim.value.logs ?? undefined }
}
