import {
  DEV_API_URLS,
  Raydium,
  type Raydium as RaydiumInstance,
} from '@raydium-io/raydium-sdk-v2'
import { Connection, PublicKey, type Keypair } from '@solana/web3.js'

export type InitSdkParams = {
  /** Fee-payer / creator pubkeys — no private key required to *build* txs. */
  owner: PublicKey | Keypair
  rpcUrl: string
  cluster: 'mainnet' | 'devnet'
  loadToken?: boolean
}

/**
 * Raydium SDK bootstrap — mirrors the docs/demo `initSdk` pattern.
 * Uses our Helius/RPC endpoint. For prepare we pass a PublicKey-only owner
 * so the server never needs the user's secret.
 */
export async function initSdk(params: InitSdkParams): Promise<RaydiumInstance> {
  const connection = new Connection(params.rpcUrl, 'confirmed')
  const owner =
    'publicKey' in params.owner && typeof (params.owner as Keypair).secretKey !== 'undefined'
      ? (params.owner as Keypair)
      : (params.owner as PublicKey)

  if (connection.rpcEndpoint.includes('api.mainnet-beta.solana.com')) {
    console.warn(
      '[launch] using public mainnet RPC — prefer HELIUS_RPC_URL / SOLANA_RPC_URL for reliability',
    )
  }

  return Raydium.load({
    owner,
    connection,
    cluster: params.cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params.loadToken,
    blockhashCommitment: 'confirmed',
    ...(params.cluster === 'devnet'
      ? {
          urlConfigs: {
            ...DEV_API_URLS,
            BASE_HOST: 'https://api-v3-devnet.raydium.io',
            OWNER_BASE_HOST: 'https://owner-v1-devnet.raydium.io',
            SWAP_HOST: 'https://transaction-v1-devnet.raydium.io',
            CPMM_LOCK: 'https://dynamic-ipfs-devnet.raydium.io/lock/cpmm/position',
          },
        }
      : {}),
  })
}
