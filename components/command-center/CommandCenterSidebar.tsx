'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { CryptoCheckLogo } from '@/components/brand/CryptoCheckLogo'
import {
  COMMAND_DASHBOARD_LINK,
  COMMAND_NAV,
  isCommandNavActive,
} from '@/lib/command-center/nav'

type Props = {
  userEmail: string
  effectiveTier: string
  isAnonymousPreview?: boolean
}

export function CommandCenterSidebar({ userEmail, effectiveTier, isAnonymousPreview }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`fixed bottom-0 left-0 top-0 z-40 hidden flex-col border-r border-[var(--cc-hairline)] bg-[var(--cc-panel)] md:flex ${
        collapsed ? 'w-[72px]' : 'w-[240px]'
      }`}
      aria-label="Command center navigation"
    >
      <div className="flex items-center justify-between border-b border-[var(--cc-inner)] px-4 py-4">
        {!collapsed ? (
          <div>
            <p className="cc-label text-[0.5rem] tracking-[0.22em] text-[var(--cc-lo)]">CRYPTOCHECK</p>
            <CryptoCheckLogo href="/dashboard" />
          </div>
        ) : (
          <span className="cc-mono text-xs font-bold text-[var(--cc-green)]">CC</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="rounded-lg border border-[var(--cc-inner)] p-1 text-[var(--cc-mid)] hover:text-[var(--cc-hi)]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <NavRow item={COMMAND_DASHBOARD_LINK} pathname={pathname} collapsed={collapsed} />

        {COMMAND_NAV.map((group) => (
          <div key={group.title} className="mt-4">
            {!collapsed ? (
              <p className="cc-label mb-2 px-3 text-[0.5rem] text-[var(--cc-lo)]">{group.title}</p>
            ) : null}
            {group.items.map((item) => (
              <NavRow key={item.href + item.label} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="m-3 cc-panel-2 overflow-hidden p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--cc-green-deep)] shadow-[0_0_20px_rgba(123,232,75,0.25)]">
              <Sparkles className="h-5 w-5 text-[var(--cc-green)]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--cc-hi)]">Neural V4</p>
              <p className="text-[0.62rem] leading-snug text-[var(--cc-lo)]">
                The most advanced AI engine in crypto
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/intelligence-terminal"
            className="mt-3 block rounded-lg bg-[var(--cc-green-deep)] px-3 py-2 text-center text-xs font-semibold text-[var(--cc-green)] hover:bg-[var(--cc-green)]/20"
          >
            Learn More
          </Link>
        </div>
      ) : null}

      <div className="border-t border-[var(--cc-inner)] px-4 py-3">
        {!collapsed ? (
          <>
            {userEmail ? (
              <p className="cc-mono truncate text-[0.65rem] text-[var(--cc-mid)]">{userEmail}</p>
            ) : (
              <p className="text-[0.65rem] text-[var(--cc-amber)]">
                Guest preview ·{' '}
                <Link href="/landing?next=%2Fdashboard" className="text-[var(--cc-green)]">
                  Sign in
                </Link>
              </p>
            )}
            <p className="cc-mono mt-1 text-[0.58rem] uppercase text-[var(--cc-lo)]">{effectiveTier} member</p>
          </>
        ) : null}
      </div>
    </aside>
  )
}

function NavRow({
  item,
  pathname,
  collapsed,
}: {
  item: (typeof COMMAND_NAV)[0]['items'][0] | typeof COMMAND_DASHBOARD_LINK
  pathname: string
  collapsed: boolean
}) {
  const active = isCommandNavActive(pathname, item.href)
  const Icon = item.icon
  const isHash = item.href.startsWith('#')

  const cls = `group mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
    active
      ? 'bg-[var(--cc-green-dim)] text-[var(--cc-green)]'
      : 'text-[var(--cc-mid)] hover:bg-white/[0.03] hover:text-[var(--cc-hi)]'
  }`

  const inner = (
    <>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.5} />
      {!collapsed ? <span className="truncate font-medium">{item.label}</span> : null}
      {!collapsed && item.badge ? (
        <span
          className={`ml-auto rounded px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-wider ${
            item.badge === 'HOT'
              ? 'bg-[var(--cc-red)]/15 text-[var(--cc-red)]'
              : 'bg-[var(--cc-green)]/15 text-[var(--cc-green)]'
          }`}
        >
          {item.badge}
        </span>
      ) : null}
    </>
  )

  if (isHash) {
    return (
      <a href={item.href} className={cls}>
        {inner}
      </a>
    )
  }

  return (
    <Link href={item.href} prefetch={false} className={cls}>
      {inner}
    </Link>
  )
}
