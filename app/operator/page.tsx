import Link from 'next/link'
import { OPERATOR_NAV } from '@/lib/operator/nav'

export const dynamic = 'force-dynamic'

export default function OperatorHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-mono text-base font-semibold text-zinc-100">Ops index</h2>
        <p className="mt-1 max-w-xl font-mono text-xs leading-relaxed text-zinc-500">
          Platform tooling only. Trading customers use /dashboard — this surface is server-gated to
          @cryptocheckai.com / DIAGNOSTICS_ADMIN_EMAILS / ADMIN_WALLETS.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {OPERATOR_NAV.filter((i) => i.href !== '/operator').map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-50"
            >
              <item.icon className="h-3.5 w-3.5 text-zinc-500" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
