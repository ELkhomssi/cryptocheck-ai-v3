/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CRYPTOCHECK_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
