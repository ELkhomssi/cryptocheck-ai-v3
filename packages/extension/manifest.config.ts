import { defineManifest } from '@crxjs/vite-plugin'

/** Paths are relative to the extension package root; Vite copies `public/icons/*` into `dist/icons/`. */
const brandIcons = {
  16: 'icons/icon16.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
} as const

export default defineManifest({
  manifest_version: 3,
  name: 'CryptoCheck AI',
  version: '0.1.0',
  description: 'Neural intelligence for Solana — scan tokens from any page.',
  icons: brandIcons,
  action: {
    default_popup: 'index.html',
    default_title: 'CryptoCheck AI',
    default_icon: brandIcons,
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['storage', 'contextMenus', 'tabs'],
  host_permissions: ['https://www.cryptocheckai.com/*'],
})
