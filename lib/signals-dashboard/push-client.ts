/**
 * Premium PWA push — register service worker + Web Push subscription.
 */
export async function registerSignalsPush(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'Push not supported' }
  }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: 'Permission denied' }

  const reg = await navigator.serviceWorker.register('/sw-signals.js', { scope: '/dashboard/signals/' })

  const keyRes = await fetch('/api/signals/vapid-public-key')
  const keyJson = (await keyRes.json()) as { configured?: boolean; publicKey?: string }
  if (!keyJson.configured || !keyJson.publicKey) {
    return { ok: false, reason: 'Push not configured server-side' }
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey),
  })

  const json = sub.toJSON()
  const res = await fetch('/api/signals/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false, reason: (body as { error?: string }).error ?? 'Subscribe failed' }
  }

  return { ok: true }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}
