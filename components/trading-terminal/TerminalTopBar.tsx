'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, Search } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { useTerminalFocus } from './TerminalFocusProvider'

export function TerminalTopBar({ onHelp }: { onHelp?: () => void }) {
  const { selectMint } = useTerminalFocus()
  const { walletAddress, isConnected, connect, shortAddr } = useSolana()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const chipLabel =
    isConnected && walletAddress
      ? shortAddr || `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
      : null

  return (
    <header className="tit-area-top tit-topbar" style={{ height: 'var(--tit-topbar)' }}>
      <form
        className="tit-topbar-search"
        onSubmit={(e) => {
          e.preventDefault()
          const q = query.trim()
          if (q.length >= 32) selectMint(q)
        }}
      >
        <Search className="h-[15px] w-[15px] shrink-0" strokeWidth={2} />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tokens, wallets, or portfolios…"
          aria-label="Global search"
        />
        <span className="tit-kbd">⌘K</span>
      </form>

      <div className="flex shrink-0 items-center gap-3.5">
        <div className="tit-chip">
          <span className="dot" aria-hidden />
          Solana
          <ChevronDown className="h-3 w-3" strokeWidth={2} aria-hidden />
        </div>

        <button
          type="button"
          className="tit-icon-btn"
          aria-label="Notifications"
          onClick={() => onHelp?.()}
        >
          <span className="ping" aria-hidden />
          <Bell className="h-[17px] w-[17px]" strokeWidth={1.7} />
        </button>

        {isConnected && chipLabel ? (
          <button type="button" className="tit-id-chip" aria-label="Connected wallet">
            <div className="avatar tit-num">{chipLabel.slice(0, 2)}</div>
            <span className="tit-num">{chipLabel}</span>
          </button>
        ) : (
          <button type="button" className="tit-connect-btn" onClick={() => void connect()}>
            Connect
          </button>
        )}
      </div>
    </header>
  )
}
