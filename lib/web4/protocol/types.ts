export type TxPhase =
  | 'idle'
  | 'building'
  | 'signed'
  | 'sent'
  | 'processed'
  | 'confirmed'
  | 'finalized'
  | 'error'

export type TxLifecycle = {
  phase: TxPhase
  signature: string | null
  error?: string
}

export type ProtocolStats = {
  totalVolumeLamports: string
  tokensGraduated: number
  activePools: number
  connectedWalletsEstimate: number
  solUsd: number
  updatedAt: number
  source: 'chain' | 'indexed' | 'hybrid'
}

export type PoolAccountSnapshot = {
  mint: string
  virtualSolLamports: bigint
  virtualTokenBase: bigint
  realSolLamports: bigint
  tokensSoldBase: bigint
  graduated: boolean
  bump: number
  vaultBump: number
  name: string
  symbol: string
}
