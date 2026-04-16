'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { CryptoCheckLogo } from '@/components/brand/CryptoCheckLogo'
import {
  isNavActive,
  primaryNavItems,
  secondaryNavItems,
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
  const { href, label, icon: Icon } = item
  const active = isNavActive(pathname, href)
  return (
    <Link
      href={href}
      onClick={() => {
        tapFeedback()
        onNavigate()
      }}
      className={`flex items-center gap-3 rounded-lg px-4 py-4 text-sm font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
        active
          ? 'border-l-2 border-[#00d4aa] bg-white/[0.08] pl-[14px] text-slate-100'
          : 'border-l-2 border-transparent text-slate-300 hover:bg-white/[0.05]'
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-[#00d4aa]' : 'text-slate-500'}`} strokeWidth={active ? 2 : 1.35} />
      {label}
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
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 top-0 flex w-[min(100vw-2.5rem,20rem)] flex-col border-r border-white/[0.08] bg-[rgba(7,7,9,0.98)] shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
          <CryptoCheckLogo href="/dashboard" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-4" aria-label="Dashboard">
          {primaryNavItems.map((item) => (
            <DrawerLink key={item.href} item={item} pathname={pathname} onNavigate={onClose} />
          ))}
          <div className="my-4 border-t border-white/5" role="presentation" />
          <p className="mb-1 px-4 text-[10px] font-medium uppercase tracking-widest text-white/40">PRO SURFACE</p>
          {secondaryNavItems.map((item) => (
            <DrawerLink key={item.href} item={item} pathname={pathname} onNavigate={onClose} />
          ))}
        </nav>
      </div>
    </div>
  )
}
