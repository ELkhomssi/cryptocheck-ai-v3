'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { CryptoCheckLogo } from '@/components/brand/CryptoCheckLogo'
import {
  isNavActive,
  primaryNavItems,
  type DashboardNavItem,
} from '@/components/Dashboard/dashboard-nav-config'
import { X } from 'lucide-react'

function tapFeedback() {
  if (typeof navigator === 'undefined') return
  navigator.vibrate?.(8)
}

function DrawerLink({
  item,
  pathname,
  onNavigate,
}: {
  item: DashboardNavItem
  pathname: string
  onNavigate: () => void
}) {
  const { href, label, icon: Icon, badge } = item
  const active = isNavActive(pathname, href)
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={() => {
        tapFeedback()
        onNavigate()
      }}
      className={`flex items-center gap-3 rounded-lg px-4 py-3.5 font-mono text-sm tracking-wide ${
        active ? 'bg-white/[0.08] text-zinc-50' : 'text-zinc-400 hover:bg-white/[0.05]'
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-emerald-400' : 'text-zinc-600'}`} strokeWidth={active ? 2 : 1.35} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            active
              ? 'border-sky-400/35 bg-sky-400/10 text-sky-300'
              : 'border-white/[0.08] bg-white/[0.03] text-zinc-600'
          }`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

export function MobileDrawer({
  open,
  onClose,
  pathname,
}: {
  open: boolean
  onClose: () => void
  pathname: string
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close menu" onClick={onClose} />
      <div className="absolute bottom-0 left-0 top-0 flex w-[min(100vw-2.5rem,20rem)] flex-col border-r border-white/[0.08] bg-[#050505]/96 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
          <CryptoCheckLogo href="/dashboard" />
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400" aria-label="Close navigation">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-4" aria-label="Trading">
          {primaryNavItems.map((item) => (
            <DrawerLink key={item.href} item={item} pathname={pathname} onNavigate={onClose} />
          ))}
        </nav>
        <div className="border-t border-white/[0.06] px-4 py-4">
          <Link
            href="/dashboard/billing"
            prefetch={false}
            onClick={() => {
              tapFeedback()
              onClose()
            }}
            className="block rounded-lg px-3 py-2.5 font-mono text-sm text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
          >
            Billing
          </Link>
          <Link
            href="/dashboard/api-keys"
            prefetch={false}
            onClick={() => {
              tapFeedback()
              onClose()
            }}
            className="block rounded-lg px-3 py-2.5 font-mono text-sm text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
          >
            API keys
          </Link>
        </div>
      </div>
    </div>
  )
}
