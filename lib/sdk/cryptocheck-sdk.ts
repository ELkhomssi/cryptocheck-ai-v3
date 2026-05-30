/**
 * CryptoCheck AI — thin re-export of `@cryptocheck/ccai-connect` for in-repo consumers.
 * New integrations should depend on `@cryptocheck/ccai-connect` directly.
 */

export {
  CCAIConnectClient as CryptoCheckClient,
  CCAIConnectClient,
  CCAIConnectError as CryptoCheckError,
  CCAIConnectError,
  CONNECT_SDK_VERSION as SDK_VERSION,
  DEV_SIGNING_SALT_FALLBACK,
  DEV_SIGNING_SALT_FALLBACK as SCAN_API_DOCS_DEV_SIGNING_SALT,
  resolveConnectBaseUrl as resolveCryptocheckBaseUrl,
  type CCAIConnectClientOptions as CryptoCheckClientOptions,
} from '@cryptocheck/ccai-connect'
