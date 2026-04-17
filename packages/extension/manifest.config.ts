import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'CryptoCheck AI',
  version: '0.1.0',
  description: 'Neural intelligence for Solana — scan tokens from any page.',
  action: {
    default_popup: 'index.html',
    default_title: 'CryptoCheck AI',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['storage', 'contextMenus', 'tabs'],
  host_permissions: ['https://www.cryptocheckai.com/*'],
})
