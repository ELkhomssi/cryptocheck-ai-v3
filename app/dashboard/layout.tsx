import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ensureFreeTierSubscription } from '@/lib/services/saas-entitlement.service'

const nav = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/api-keys', label: 'API Keys' },
  { href: '/dashboard/usage', label: 'Usage' },
  { href: '/dashboard/security', label: 'Security' },
  { href: '/dashboard/billing', label: 'Billing' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/landing?next=%2Fdashboard')

  try {
    await ensureFreeTierSubscription(user.id)
  } catch {
    /* service role / DB — best effort */
  }

  return (
    <div className="min-h-screen bg-[#030308] text-zinc-100">
      <aside className="fixed left-0 top-0 z-40 flex h-full w-56 flex-col border-r border-white/[0.08] bg-[#05050c]/95 px-4 py-6 backdrop-blur">
        <div className="mb-8 px-1 font-mono text-sm font-semibold tracking-wide text-white">CryptoCheck AI</div>
        <nav className="flex flex-col gap-0.5 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/[0.06] pt-4 text-xs text-zinc-500">
          <p className="truncate px-1">{user.email}</p>
        </div>
      </aside>
      <main className="min-h-screen pl-56">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  )
}
