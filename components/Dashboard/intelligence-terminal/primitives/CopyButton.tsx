'use client'

import { Check, Copy } from 'lucide-react'
import { useCallback, useState } from 'react'

/**
 * Tiny icon-only copy button. Copies `value` to clipboard, shows a
 * check for 1.2s, reverts. `aria-label` is required because it's
 * icon-only.
 */
export function CopyButton({
  value,
  label = 'Copy to clipboard',
  className = '',
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard blocked — silently no-op; UI does nothing misleading.
    }
  }, [value])

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? 'Copied' : label}
      className={`
        inline-flex h-6 w-6 shrink-0 items-center justify-center
        rounded-md text-slate-500 transition-colors
        hover:bg-white/5 hover:text-[#00d4aa]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4aa]/50
        ${className}
      `}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[#00d4aa]" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  )
}
