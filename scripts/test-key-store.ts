/**
 * Node smoke test for lib/crypto/client-key-store.ts.
 * Installs minimal window + Web Crypto globals, then dynamic-imports the module
 * so isStrongCryptoAvailable and encrypt/decrypt run against the real code.
 */

import { webcrypto } from 'node:crypto'

function makeMemoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear() {
      m.clear()
    },
    getItem(key: string) {
      return m.has(key) ? m.get(key)! : null
    },
    setItem(key: string, value: string) {
      m.set(key, value)
    },
    removeItem(key: string) {
      m.delete(key)
    },
    key(index: number) {
      return [...m.keys()][index] ?? null
    },
  } as Storage
}

function installBrowserGlobals(): void {
  const ls = makeMemoryStorage()
  const ss = makeMemoryStorage()
  globalThis.window = {
    crypto: webcrypto,
    localStorage: ls,
    sessionStorage: ss,
  } as unknown as Window & typeof globalThis
}

async function main(): Promise<void> {
  installBrowserGlobals()

  const ks = await import('../lib/crypto/client-key-store')

  const sample = 'cc_live_test123456789012345678901234567890'

  console.log('isStrongCryptoAvailable:', ks.isStrongCryptoAvailable)

  ks.clearKey()
  console.log('(1) after clear, load:', await ks.loadEncryptedKey())
  console.log('(1b) isCurrentKeyEncrypted:', ks.isCurrentKeyEncrypted())

  await ks.storeEncryptedKey(sample)
  console.log('(2) after store, load matches:', (await ks.loadEncryptedKey()) === sample)
  console.log('(2b) isCurrentKeyEncrypted:', ks.isCurrentKeyEncrypted())

  globalThis.window.sessionStorage.removeItem(ks.SESSION_STORAGE_SALT)
  console.log('(3) after salt drop, load:', await ks.loadEncryptedKey())
  console.log('(3b) isCurrentKeyEncrypted (still v1 blob):', ks.isCurrentKeyEncrypted())

  await ks.storeEncryptedKey(sample)
  console.log('(4) after re-store, load matches:', (await ks.loadEncryptedKey()) === sample)

  ks.clearKey()
  console.log('(5) after clear, load:', await ks.loadEncryptedKey())
  console.log('(5b) isCurrentKeyEncrypted:', ks.isCurrentKeyEncrypted())

  console.log('maskKey:', ks.maskKey(sample))

  console.log('\nOK — client-key-store smoke complete.')
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
