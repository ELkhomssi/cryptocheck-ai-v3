/**
 * Resolve URLs for files emitted at the extension root (e.g. `public/logo.jpg` → `dist/logo.jpg`).
 * `chrome.runtime.getURL` is required in the packaged extension; `/logo.jpg` breaks in the `chrome-extension://` origin.
 */
export function extensionAssetUrl(path: string): string {
  const p = path.replace(/^\//, '')
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(p)
    }
  } catch {
    /* ignore */
  }
  return path.startsWith('/') ? path : `/${path}`
}
