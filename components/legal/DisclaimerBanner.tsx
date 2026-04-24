'use client'

import { useState, useEffect } from 'react'
import { DISCLAIMER_TEXT_SHORT, type DisclaimerVariant } from '@/lib/legal/disclaimer-version'

type Props = {
  variant?: DisclaimerVariant
  dismissible?: boolean
}

export function DisclaimerBanner({
  variant = 'default',
  dismissible = true,
}: Props) {
  const [hidden, setHidden] = useState(false)
  const storageKey = `cc_disclaimer_dismissed_${variant}`

  useEffect(() => {
    if (!dismissible) return
    const dismissedAt = localStorage.getItem(storageKey)
    if (!dismissedAt) return

    const daysSince = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
    if (daysSince < 30) setHidden(true)
  }, [dismissible, storageKey])

  if (hidden) return null

  function dismiss() {
    localStorage.setItem(storageKey, Date.now().toString())
    setHidden(true)
  }

  return (
    <div
      className="relative border-b border-amber-500/20 bg-amber-500/5 px-4 py-2.5"
      role="alert"
      aria-live="polite"
    >
      <p className="text-xs sm:text-sm text-amber-300/90 text-center pr-8">
        <span className="font-semibold">⚠ Important:</span>{' '}
        {DISCLAIMER_TEXT_SHORT[variant]}{' '}
        <a
          href="/terms"
          className="underline hover:text-amber-200 whitespace-nowrap"
        >
          Read full terms →
        </a>
      </p>
      {dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notice"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-amber-300/60 hover:text-amber-300"
        >
          ×
        </button>
      )}
    </div>
  )
}
