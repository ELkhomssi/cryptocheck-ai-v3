'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, Search } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { truncateWallet } from '@/lib/portfolio-desk/format'

export function Topbar() {
  const { walletAddress, isConnected, connect, disconnect, shortAddr } = useSolana()
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

  const chip =
    isConnected && walletAddress
      ? shortAddr || truncateWallet(walletAddress)
      : null

  return (
    <header className="pd-topbar">
      <form
        className="pd-search"
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <Search className="h-[15px] w-[15px] shrink-0" strokeWidth={2} />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tokens, wallets, or portfolios…"
          aria-label="Search"
        />
        <span className="pd-kbd">⌘K</span>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="pd-chip">
          <span className="dot" aria-hidden />
          Solana
          <ChevronDown className="h-3 w-3" strokeWidth={2} aria-hidden />
        </div>

        <button type="button" className="pd-icon-btn" aria-label="Notifications">
          <span className="ping" aria-hidden />
          <Bell className="h-[17px] w-[17px]" strokeWidth={1.7} />
        </button>

        {chip ? (
          <button
            type="button"
            className="pd-id-chip"
            onClick={() => disconnect()}
            title="Click to disconnect"
          >
            <div className="avatar">{chip.slice(0, 2)}</div>
            <span className="pd-num">{chip}</span>
          </button>
        ) : (
          <button type="button" className="pd-connect" onClick={() => void connect()}>
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  )
}
