'use client'

import { useEffect, useRef } from 'react'
import { Bell, ChevronDown, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSolana } from '@/components/SolanaProvider'
import { TokenSearch } from '@/components/portfolio-desk/token/TokenSearch'
import { truncateWallet } from '@/lib/portfolio-desk/format'
import type { ScreenerRow } from '@/lib/providers/types'

export function Topbar({
  alertCount = 0,
  onOpenNav,
  onSelectToken,
}: {
  alertCount?: number
  onOpenNav?: () => void
  /** Optional override — default navigates to /terminal?mint=… */
  onSelectToken?: (row: ScreenerRow) => void
}) {
  const router = useRouter()
  const { walletAddress, isConnected, connect, disconnect, shortAddr } = useSolana()
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

  const openToken = (row: ScreenerRow) => {
    if (onSelectToken) {
      onSelectToken(row)
      return
    }
    router.push(`/terminal?nav=screener&mint=${encodeURIComponent(row.mint)}`)
  }

  return (
    <header className="pd-topbar">
      {onOpenNav ? (
        <button
          type="button"
          className="pd-icon-btn pd-nav-toggle"
          aria-label="Open navigation"
          onClick={onOpenNav}
        >
          <Menu className="h-[17px] w-[17px]" strokeWidth={1.7} />
        </button>
      ) : null}

      <TokenSearch
        inputRef={searchRef}
        showShortcut
        placeholder="Search tokens to chart, watch, or swap…"
        onSelect={openToken}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="pd-chip" title="Network">
          <span className="dot" aria-hidden />
          Solana
          <ChevronDown className="h-3 w-3" strokeWidth={2} aria-hidden />
        </div>

        <button type="button" className="pd-icon-btn" aria-label="Notifications">
          {alertCount > 0 ? <span className="ping" aria-hidden /> : null}
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
