'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  bottomPrimaryNavItems,
  isNavActive,
  moreMenuIcon as MoreIcon,
  moreSheetNavItems,
  type DashboardNavItem,
} from '@/components/Dashboard/dashboard-nav-config'

function tapFeedback() {
  if (typeof navigator === 'undefined') return
  navigator.vibrate?.(8)
}

function BottomItem({
  item,
  pathname,
}: {
  item: DashboardNavItem
  pathname: string
}) {
  const { href, label, icon: Icon } = item
  const active = isNavActive(pathname, href)
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={() => tapFeedback()}
      className={`relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-3 font-space text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617] ${
        active ? 'text-emerald-400' : 'text-slate-500'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400" aria-hidden />}
      <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.5} aria-hidden />
      <span className={`max-w-[4.5rem] truncate text-center leading-tight ${active ? 'font-bold text-slate-100' : ''}`}>
        {label}
      </span>
    </Link>
  )
}

export function MobileBottomNav({ pathname }: { pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = moreSheetNavItems.some((item) => isNavActive(pathname, item.href))

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-white/[0.08] bg-[rgba(6,7,10,0.94)] backdrop-blur-xl md:hidden pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Primary"
      >
        {bottomPrimaryNavItems.map((item) => (
          <BottomItem key={item.href} item={item} pathname={pathname} />
        ))}
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            setMoreOpen((o) => !o)
          }}
          className={`relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-3 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
            moreOpen || moreActive ? 'text-[#00d4aa]' : 'text-slate-500'
          }`}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          aria-label="More navigation options"
        >
          {(moreOpen || moreActive) && (
            <span className="absolute inset-x-0 top-0 h-0.5 bg-[#00d4aa]" aria-hidden />
          )}
          <MoreIcon className="h-5 w-5" strokeWidth={moreOpen || moreActive ? 2.25 : 1.5} aria-hidden />
          <span className={`max-w-[4.5rem] truncate text-center leading-tight ${moreActive ? 'font-bold text-slate-100' : ''}`}>
            More
          </span>
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[90] md:hidden" role="dialog" aria-modal="true" aria-labelledby="more-sheet-title">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close more menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[50vh] overflow-y-auto rounded-t-2xl border border-white/[0.08] border-b-0 bg-[rgba(10,11,14,0.98)] px-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4 shadow-2xl">
            <p id="more-sheet-title" className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              More
            </p>
            {moreSheetNavItems.map((item) => {
              const { href, label, icon: Icon, badge } = item
              const active = isNavActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  onClick={() => {
                    tapFeedback()
                    setMoreOpen(false)
                  }}
                  className={`flex items-center gap-3 rounded-xl px-4 py-4 text-sm font-medium ${
                    active ? 'bg-white/[0.08] text-[#00d4aa]' : 'text-slate-200 hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  <span>{label}</span>
                  {badge ? (
                    <span className="ml-auto rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-cyan-300">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
