export { CONNECT_SDK_VERSION, CCAIConnectClient, CryptoCheckClient, type CCAIConnectClientOptions } from './client.js'
export { CCAIConnectError, errorMessageFromBody } from './errors.js'
export { resolveConnectBaseUrl, resolveSigningSalt } from './resolve.js'
export type {
  AssessDepth,
  AssessRiskParams,
  BatchScanItem,
  ConnectChainId,
  InstitutionalScanResult,
  PlatformScanResult,
  ReputationParams,
  ReputationSnapshot,
  ScanResponseMode,
} from './types.js'

export {
  DEV_SIGNING_SALT_FALLBACK,
  buildRequestSignature,
  deriveApiHmacSigningKey,
  verifySignature,
} from '@cryptocheck/signing'
