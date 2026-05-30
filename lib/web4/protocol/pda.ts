import { PublicKey } from '@solana/web3.js'
import { getWeb4ProgramId } from './config'

export function poolPda(mint: PublicKey): [PublicKey, number] {
  const programId = getWeb4ProgramId()
  if (!programId) throw new Error('WEB4 program id not configured')
  return PublicKey.findProgramAddressSync([Buffer.from('pool'), mint.toBuffer()], programId)
}

export function vaultAuthorityPda(mint: PublicKey): [PublicKey, number] {
  const programId = getWeb4ProgramId()
  if (!programId) throw new Error('WEB4 program id not configured')
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault_authority'), mint.toBuffer()],
    programId,
  )
}

export function protocolStatsPda(): [PublicKey, number] {
  const programId = getWeb4ProgramId()
  if (!programId) throw new Error('WEB4 program id not configured')
  return PublicKey.findProgramAddressSync([Buffer.from('protocol_stats')], programId)
}
