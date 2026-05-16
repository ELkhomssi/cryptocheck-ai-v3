/** Mobile Safari/Chrome has no extension — open the current page in Phantom's in-app browser. */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent)
}

/** True when running inside Phantom, Backpack, Solflare, or similar in-app browsers. */
export function isInAppWalletBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return ['phantom', 'backpack', 'solflare', 'metamask', 'trust', 'coinbasewallet', 'tokenpocket', 'okx', 'rainbow'].some(
    (s) => ua.includes(s),
  )
}

function hasInjectedSolanaProvider(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as Window & {
    solana?: { isPhantom?: boolean; isBackpack?: boolean }
    phantom?: { solana?: unknown }
  }
  return !!(w.solana?.isPhantom || w.phantom?.solana || w.solana?.isBackpack)
}

export function shouldUsePhantomMobileDeepLink(): boolean {
  return isMobileDevice() && !isInAppWalletBrowser() && !hasInjectedSolanaProvider()
}

export function openPhantomMobileBrowse(): void {
  window.location.href = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`
}

/** Run before the wallet-adapter connect flow on user-initiated connect clicks. */
export async function handleMobileAwareWalletConnect(connect: () => Promise<void>): Promise<void> {
  if (shouldUsePhantomMobileDeepLink()) {
    openPhantomMobileBrowse()
    return
  }
  await connect()
}
