'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Toast = { id: number; message: string }

type DashToastApi = {
  push: (message: string) => void
}

let pushImpl: ((message: string) => void) | null = null
const pending: string[] = []

/** Fire a toast from anywhere under DashToastProvider (Rewards, Action Panel, etc.). */
export function dashToast(message: string): void {
  if (pushImpl) {
    pushImpl(message)
    return
  }
  pending.push(message)
}

export function DashToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    pushImpl = (message: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000)
      setToasts((t) => [...t, { id, message }])
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id))
      }, 4200)
    }
    if (pending.length) {
      const queued = pending.splice(0, pending.length)
      for (const m of queued) pushImpl(m)
    }
    return () => {
      pushImpl = null
    }
  }, [])

  return (
    <>
      {children}
      {mounted
        ? createPortal(
            <div className="pointer-events-none fixed bottom-6 right-6 z-[200] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
              {toasts.map((t) => (
                <div
                  key={t.id}
                  className="pointer-events-auto rounded-dash border border-dash-green/35 bg-dash-panel px-4 py-3 text-sm text-dash-thi shadow-[0_0_24px_rgba(34,197,94,0.2)]"
                  role="status"
                >
                  {t.message}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export type { DashToastApi }
