import { createClientOptional } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase'
import { ensureFreeTierSubscription } from '@/lib/services/saas-entitlement.service'
import { getUserSubscription } from '@/lib/services/user-subscription.service'
import { JetBrains_Mono } from 'next/font/google'
import '@/lib/dashboard/tokens.css'
import { DashboardNew } from '@/components/dash-home/DashboardNew'

const dashMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dash-mono',
  display: 'swap',
})

export const dynamic = 'force-dynamic'

export default async function DashboardHomePage() {
  const supabase = await createClientOptional()
  const user = supabase ? (await supabase.auth.getUser()).data.user : null

  let userEmail = ''
  let effectiveTier = 'FREE'
  if (user) {
    userEmail = user.email ?? ''
    try {
      await ensureFreeTierSubscription(user.id)
    } catch {
      /* best effort */
    }
    const sub = await getUserSubscription(user.id)
    effectiveTier = sub.effectiveTier
  }

  return (
    <div className={`${dashMono.variable} font-sans`}>
      <DashboardNew
        userEmail={userEmail}
        effectiveTier={effectiveTier}
        isAnonymousPreview={!isSupabaseConfigured() || !user}
      />
    </div>
  )
}
