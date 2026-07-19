self.addEventListener('push', (event) => {
  let data = { title: 'CryptoCheck Signal', body: 'New SAFE signal', url: '/dashboard/signals' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    /* default */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo.jpg',
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard/signals'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client && (client.url.includes('/dashboard/signals') || client.url.includes('/dashboard'))) {
          if (typeof client.navigate === 'function' && url) {
            try {
              return client.navigate(url).then(() => client.focus())
            } catch {
              return client.focus()
            }
          }
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    }),
  )
})
