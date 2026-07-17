'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OPERATOR_NAV } from '@/lib/operator/nav'

export function OperatorShell({
  children,
  userEmail,
}: {
  children: React.ReactNode
  userEmail: string
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#111] px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">CryptoCheck</p>
            <h1 className="font-mono text-sm font-semibold text-zinc-100">Operator Console</h1>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500">
            <span className="truncate max-w-[14rem]">{userEmail || '—'}</span>
            <Link href="/dashboard" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
              Trading workspace
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-zinc-800 md:w-56 md:border-b-0 md:border-r">
          <nav className="flex flex-row gap-1 overflow-x-auto p-2 md:flex-col" aria-label="Operator">
            {OPERATOR_NAV.map(({ href, label, icon: Icon }) => {
              const active =
                href === '/operator' ? pathname === '/operator' : Boolean(pathname?.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 whitespace-nowrap rounded px-2.5 py-1.5 font-mono text-[11px] ${
                    active ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {label}
                </Link>
              )
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  )
}
