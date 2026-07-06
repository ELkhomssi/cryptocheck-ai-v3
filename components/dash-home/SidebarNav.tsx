'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DASHBOARD_NAV, isDashNavActive } from '@/lib/dashboard/nav'
import { NeuralV4PromoCard } from './NeuralV4PromoCard'

export type SidebarNavProps = {
  userEmail?: string
  effectiveTier?: string
  collapsed: boolean
  onCollapsedChange: (v: boolean) => void
  mobileOpen: boolean
  onMobileOpenChange: (v: boolean) => void
}

export function SidebarNav({
  userEmail,
  effectiveTier,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
}: SidebarNavProps) {
  const pathname = usePathname()
  const width = collapsed ? 'w-16' : 'w-[232px]'

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen, onMobileOpenChange])

  const navBody = (
    <>
      <div className="relative flex items-center gap-2 border-b border-dash-innerline px-4 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-dash-chip bg-dash-green text-sm font-bold text-dash-bg">
          C
        </span>
        {!collapsed ? (
          <p className="text-[15px] font-semibold text-dash-thi">
            CRYPTOCHECK <span className="text-dash-green">AI</span>
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="absolute right-2 top-3 hidden rounded-dash-chip border border-dash-innerline p-1 text-dash-tmid transition-colors duration-150 hover:text-dash-thi focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green min-[1100px]:block"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onMobileOpenChange(false)}
          className="absolute right-2 top-3 rounded-dash-chip border border-dash-innerline p-1 text-dash-tmid min-[1100px]:hidden"
          aria-label="Close menu"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {DASHBOARD_NAV.map((group) => (
          <div key={group.title} className="mb-4">
            {!collapsed ? (
              <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.14em] text-dash-tlo">
                {group.title}
              </p>
            ) : null}
            {group.items.map((item) => {
              const active = isDashNavActive(pathname ?? '', item.href)
              const Icon = item.icon
              const inner = (
                <>
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-dash-green' : 'text-dash-tlo'}`} />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  {!collapsed && item.badge ? (
                    <span
                      className={`ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        item.badge === 'HOT'
                          ? 'bg-dash-red text-white'
                          : 'bg-dash-greenDim text-dash-green'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </>
              )
              const cls = `mb-1 flex items-center gap-3 rounded-dash-pill px-3 py-2 text-[13px] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-dash-green ${
                active
                  ? 'bg-dash-greenDim font-medium text-dash-thi'
                  : 'text-dash-tmid hover:bg-dash-panel2 hover:text-dash-thi'
              }`
              if (item.href.includes('#') || item.external) {
                return (
                  <a key={item.label} href={item.href} className={cls} onClick={() => onMobileOpenChange(false)}>
                    {inner}
                  </a>
                )
              }
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  prefetch={false}
                  className={cls}
                  onClick={() => onMobileOpenChange(false)}
                >
                  {inner}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="m-3">
          <NeuralV4PromoCard />
        </div>
      ) : null}

      {!collapsed && userEmail ? (
        <div className="border-t border-dash-innerline px-4 py-3">
          <p className="font-dash-mono truncate text-[11px] text-dash-tmid">{userEmail}</p>
          <p className="text-[10px] uppercase text-dash-tlo">{effectiveTier} member</p>
        </div>
      ) : null}
    </>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => onMobileOpenChange(true)}
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-dash-chip border border-dash-hairline bg-dash-panel text-dash-tmid min-[1100px]:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 min-[1100px]:hidden"
          aria-label="Close overlay"
          onClick={() => onMobileOpenChange(false)}
        />
      ) : null}

      <aside
        className={`z-50 flex flex-col border-r border-dash-hairline bg-dash-panel transition-[width] duration-150 max-[1099px]:fixed max-[1099px]:bottom-0 max-[1099px]:left-0 max-[1099px]:top-0 min-[1100px]:relative ${width} ${mobileOpen ? 'max-[1099px]:flex' : 'max-[1099px]:hidden'}`}
        aria-label="Dashboard navigation"
      >
        {navBody}
      </aside>
    </>
  )
}
