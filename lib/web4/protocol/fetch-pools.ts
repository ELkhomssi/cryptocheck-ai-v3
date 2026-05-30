import type { Connection } from '@solana/web3.js'
import { getWeb4ProgramId } from './config'
import { decodePoolAccount } from './decode-pool'
import type { PoolAccountSnapshot } from './types'

export async function fetchAllPools(connection: Connection): Promise<PoolAccountSnapshot[]> {
  const programId = getWeb4ProgramId()
  if (!programId) return []

  const accounts = await connection.getProgramAccounts(programId, {
    commitment: 'confirmed',
  })

  const pools: PoolAccountSnapshot[] = []
  for (const { account } of accounts) {
    const decoded = decodePoolAccount(account.data as Buffer)
    if (decoded) pools.push(decoded)
  }
  return pools
}
