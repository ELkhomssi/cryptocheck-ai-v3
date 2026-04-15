import { redirect } from 'next/navigation'
import { Inter } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { ensureFreeTierSubscription } from '@/lib/services/saas-entitlement.service'
import { getUserSubscription } from '@/lib/services/user-subscription.service'
import { DashboardShell } from '@/components/Dashboard/DashboardShell'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

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

  const sub = await getUserSubscription(user.id)

  return (
    <div className={`${inter.className} antialiased`}>
      <DashboardShell userEmail={user.email ?? ''} effectiveTier={sub.effectiveTier}>
        {children}
      </DashboardShell>
    </div>
  )
}
